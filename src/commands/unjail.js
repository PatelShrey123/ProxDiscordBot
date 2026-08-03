import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getJailRecord, removeJailRecord, addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('unjail')
  .setDescription('Release a member from the jar (jail)')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to unjail')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;
  const executor = interaction.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('❌ You do not have permission to unjail members.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  try {
    const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
    
    // 1. Get saved roles from database
    const record = await getJailRecord(guild.id, targetUser.id);
    
    if (record && record.roles && record.roles.length > 0) {
      // 2. Restore saved roles
      const rolesToRestore = record.roles.filter(id => guild.roles.cache.has(id));
      await targetMember.roles.set(rolesToRestore, 'Released from jail');
      await removeJailRecord(guild.id, targetUser.id);
    } else {
      // 3. Fallback: just remove jail role if no database record exists
      if (jailRole) {
        await targetMember.roles.remove(jailRole, 'Released from jail (no backup roles found)');
      }
    }

    // 4. Save history to moderation log
    await addModerationAction(guild.id, targetUser.id, executor.id, 'UNJAIL', 'Released from the jar');

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle('🕊️ Member Unjailed')
      .setDescription(`Successfully released **${targetUser.tag}** from the jar.`)
      .addFields(
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Inform in jar channel too if possible
    const jarChannel = await guild.channels.fetch('1533840932481269891').catch(() => null);
    if (jarChannel) {
      await jarChannel.send(`🕊️ **${targetUser.tag}** has been released from the jar by ${executor}.`).catch(() => null);
    }
  } catch (err) {
    console.error('[Unjail] Error:', err.message);
    await interaction.editReply('⚠️ Failed to unjail member. Check my role permissions.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('❌ You do not have permission to unjail members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to unjail: `.unjail @user`');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) return message.reply('❌ User not found in server.');

  try {
    const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
    const record = await getJailRecord(guild.id, targetUser.id);
    
    if (record && record.roles && record.roles.length > 0) {
      const rolesToRestore = record.roles.filter(id => guild.roles.cache.has(id));
      await targetMember.roles.set(rolesToRestore, 'Released from jail');
      await removeJailRecord(guild.id, targetUser.id);
    } else {
      if (jailRole) {
        await targetMember.roles.remove(jailRole, 'Released from jail');
      }
    }

    await addModerationAction(guild.id, targetUser.id, executor.id, 'UNJAIL', 'Released from the jar');

    const jarChannel = await guild.channels.fetch('1533840932481269891').catch(() => null);
    if (jarChannel) {
      await jarChannel.send(`🕊️ **${targetUser.username}** has been released from the jar by ${executor.user.username}.`).catch(() => null);
    }

    return message.reply(`🕊️ Successfully released **${targetUser.username}** from the jar.`);
  } catch (err) {
    console.error('[Unjail Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to unjail member.');
  }
}
