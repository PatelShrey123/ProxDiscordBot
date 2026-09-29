import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getJailRoles, addJailRole, removeJailRole, clearJailRoles } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('jailroles')
  .setDescription('Configure which roles can view and respond to jail appeal tickets')
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Add a role that can view jail appeal tickets')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('The role to grant appeal ticket access')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove a role from viewing jail appeal tickets')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('The role to remove')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List all roles currently allowed to view jail appeal tickets')
  )
  .addSubcommand(sub =>
    sub.setName('clear')
      .setDescription('Clear all configured jail appeal viewer roles')
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only Admins or Manage Server / Manage Roles
  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && 
      !executor.permissions.has(PermissionFlagsBits.ManageGuild) && 
      !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('❌ You do not have permission to configure jail appeal roles.');
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const role = interaction.options.getRole('role');
    if (!role) return interaction.editReply('❌ Invalid role provided.');

    if (role.id === guild.id) {
      return interaction.editReply('❌ You cannot add the `@everyone` role to private jail tickets.');
    }

    const current = await getJailRoles(guild.id);
    if (current.includes(role.id)) {
      return interaction.editReply(`ℹ️ **${role.name}** is already configured as a jail appeal viewer role.`);
    }

    const success = await addJailRole(guild.id, role.id);
    if (!success) {
      return interaction.editReply('❌ Failed to update jail roles in the database.');
    }

    const embed = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle('⚖️ Jail Appeal Role Added')
      .setDescription(`Members with **${role}** will now automatically see and be able to respond to all new **Jail Appeal Tickets**.`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'remove') {
    const role = interaction.options.getRole('role');
    if (!role) return interaction.editReply('❌ Invalid role provided.');

    const current = await getJailRoles(guild.id);
    if (!current.includes(role.id)) {
      return interaction.editReply(`ℹ️ **${role.name}** is not in the jail appeal roles list.`);
    }

    const success = await removeJailRole(guild.id, role.id);
    if (!success) {
      return interaction.editReply('❌ Failed to remove role from the database.');
    }

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle('⚖️ Jail Appeal Role Removed')
      .setDescription(`Removed **${role}** from jail appeal ticket viewers.`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'clear') {
    await clearJailRoles(guild.id);
    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('⚖️ Jail Appeal Roles Cleared')
      .setDescription('All custom jail appeal viewer roles have been removed. Only administrators and the server owner can now view new appeal tickets.')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'list') {
    const roleIds = await getJailRoles(guild.id);
    const roleList = roleIds
      .map(id => guild.roles.cache.get(id))
      .filter(Boolean)
      .map(r => `• ${r} (\`${r.id}\`)`);

    const embed = new EmbedBuilder()
      .setColor('#7A5901')
      .setTitle('⚖️ Jail Appeal Viewer Roles')
      .setDescription(
        roleList.length > 0
          ? `These roles can see and respond to jailed members' appeal tickets:\n\n${roleList.join('\n')}`
          : '⚠️ No roles are currently configured. Only Administrators can view jail appeal tickets.\n\nUse `/jailroles add <role>` to configure staff roles.'
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}

function resolveRole(guild, input) {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Role mention <@&id>
  const mentionMatch = trimmed.match(/^<@&(\d+)>$/);
  if (mentionMatch) return guild.roles.cache.get(mentionMatch[1]) || null;

  // 2. Raw ID
  if (/^\d+$/.test(trimmed)) return guild.roles.cache.get(trimmed) || null;

  // 3. Name lookup (case-insensitive)
  const query = trimmed.toLowerCase().replace(/^@/, '');
  return guild.roles.cache.find(r => r.name.toLowerCase() === query) || null;
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && 
      !executor.permissions.has(PermissionFlagsBits.ManageGuild) && 
      !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('❌ You do not have permission to configure jail appeal roles.');
  }

  const sub = (args[0] || 'list').toLowerCase();

  if (sub === 'add') {
    const roleInput = args.slice(1).join(' ');
    const role = resolveRole(guild, roleInput);
    if (!role) {
      return message.reply('❌ Please specify a valid role: `.jailroles add @role`');
    }

    if (role.id === guild.id) {
      return message.reply('❌ You cannot add the `@everyone` role.');
    }

    const current = await getJailRoles(guild.id);
    if (current.includes(role.id)) {
      return message.reply(`ℹ️ **${role.name}** is already configured as a jail appeal viewer role.`);
    }

    await addJailRole(guild.id, role.id);
    return message.reply(`✅ Added **${role.name}** to jail appeal ticket viewers.`);
  }

  if (sub === 'remove') {
    const roleInput = args.slice(1).join(' ');
    const role = resolveRole(guild, roleInput);
    if (!role) {
      return message.reply('❌ Please specify a valid role: `.jailroles remove @role`');
    }

    const current = await getJailRoles(guild.id);
    if (!current.includes(role.id)) {
      return message.reply(`ℹ️ **${role.name}** is not in the jail appeal roles list.`);
    }

    await removeJailRole(guild.id, role.id);
    return message.reply(`🗑️ Removed **${role.name}** from jail appeal ticket viewers.`);
  }

  if (sub === 'clear') {
    await clearJailRoles(guild.id);
    return message.reply('🧹 Cleared all custom jail appeal viewer roles.');
  }

  // Default: list
  const roleIds = await getJailRoles(guild.id);
  const roleList = roleIds
    .map(id => guild.roles.cache.get(id))
    .filter(Boolean)
    .map(r => `• ${r} (\`${r.id}\`)`);

  const embed = new EmbedBuilder()
    .setColor('#7A5901')
    .setTitle('⚖️ Jail Appeal Viewer Roles')
    .setDescription(
      roleList.length > 0
        ? `These roles can see and respond to jailed members' appeal tickets:\n\n${roleList.join('\n')}`
        : '⚠️ No roles are currently configured. Only Administrators can view jail appeal tickets.\n\nUse `.jailroles add @role` to add staff roles.'
    )
    .setFooter({ text: 'Commands: .jailroles add <role> | remove <role> | clear | list' })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}
