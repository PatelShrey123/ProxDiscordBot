import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute a member in the server')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to mute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for muting')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;

  const executor = interaction.member;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  // Hierarchy & Permissions Check
  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to mute members.');
  }

  if (targetMember.id === guild.ownerId) {
    return interaction.editReply('❌ You cannot mute the server owner.');
  }

  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return interaction.editReply('❌ You cannot mute this member because they have a higher or equal role hierarchy than you.');
  }

  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return interaction.editReply('❌ I cannot mute this member because they have a higher or equal role hierarchy than me.');
  }

  try {
    // Look for or create Muted role
    let muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) {
      muteRole = await guild.roles.create({
        name: 'Muted',
        permissions: [],
        reason: 'Required for mute command functionality'
      });
      // Setup overrides for all text channels
      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased()) {
          await channel.permissionOverwrites.create(muteRole, {
            SendMessages: false,
            AddReactions: false
          }).catch(() => {});
        }
      }
    }

    if (targetMember.roles.cache.has(muteRole.id)) {
      return interaction.editReply(`ℹ️ **${targetUser.username}** is already muted.`);
    }

    await targetMember.roles.add(muteRole, reason);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', reason);

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔇 Member Muted')
      .setDescription(`Successfully muted **${targetUser.tag}**`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Mute] Error:', err.message);
    await interaction.editReply('⚠️ Failed to mute member. Check my role permissions.');
  }
}

// Support standard prefix invocation for mute and unmute
export async function executePrefix(message, args, isUnmute = false) {
  const guild = message.guild;
  const executor = message.member;
  
  if (isUnmute) {
    if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ You do not have permission to unmute members.');
    }

    const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
    if (!targetUser) {
      return message.reply('❌ Please specify a user to unmute: `.unmute @user` or `.unmute [user_id]`');
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) return message.reply('❌ User not found in server.');

    const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole || !targetMember.roles.cache.has(muteRole.id)) {
      return message.reply(`ℹ️ **${targetUser.username}** is not muted.`);
    }

    try {
      await targetMember.roles.remove(muteRole, 'Unmuted by prefix command');
      await addModerationAction(guild.id, targetUser.id, executor.id, 'UNMUTE', 'Unmuted by prefix command');
      return message.reply(`✅ Unmuted **${targetUser.username}** successfully.`);
    } catch {
      return message.reply('⚠️ Failed to unmute. Make sure I have appropriate permissions.');
    }
  } else {
    // Mute Flow
    if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ You do not have permission to mute members.');
    }

    const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
    if (!targetUser) {
      return message.reply('❌ Please specify a user to mute: `.mute @user [reason]`');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) return message.reply('❌ User not found in server.');

    if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot mute owner.');
    if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
      return message.reply('❌ Hierarchy error.');
    }
    if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
      return message.reply('❌ I cannot mute this member because they are higher than me.');
    }

    try {
      let muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!muteRole) {
        muteRole = await guild.roles.create({ name: 'Muted', permissions: [] });
      }
      await targetMember.roles.add(muteRole, reason);
      await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', reason);
      return message.reply(`✅ Muted **${targetUser.username}** successfully. Reason: \`${reason}\``);
    } catch {
      return message.reply('⚠️ Failed to mute.');
    }
  }
}
