import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const muteExpirations = new Map(); // Kept for index.js import compatibility (empty now since Discord native timeout handles timed mutes)

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Temporarily mute (timeout) a member in the server')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to mute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration of the mute (e.g. 5m, 2h, 1d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for muting')
      .setRequired(false)
  );

function parseDuration(str) {
  if (!str) return null;
  const regex = /^(\d+)([smhd])$/i;
  const match = str.match(regex);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return { ms: num * 1000, label: `${num} seconds` };
    case 'm': return { ms: num * 60 * 1000, label: `${num} minutes` };
    case 'h': return { ms: num * 60 * 60 * 1000, label: `${num} hours` };
    case 'd': return { ms: num * 24 * 60 * 60 * 1000, label: `${num} days` };
    default: return null;
  }
}

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const durationStr = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;
  const executor = interaction.member;

  const parsed = parseDuration(durationStr);
  if (!parsed) {
    return interaction.editReply('❌ Invalid duration format. Please use e.g. `5m`, `2h`, `1d`.');
  }

  // Max Discord native timeout is 28 days
  if (parsed.ms > 28 * 24 * 60 * 60 * 1000) {
    return interaction.editReply('❌ Native Discord timeout duration cannot exceed 28 days. For permanent mutes, use `/permamute`.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to mute members.');
  }

  if (targetMember.id === guild.ownerId) {
    return interaction.editReply('❌ You cannot mute the server owner.');
  }

  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return interaction.editReply('❌ Hierarchy error. You cannot mute this member.');
  }

  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return interaction.editReply('❌ Bot hierarchy error. I cannot mute this member.');
  }

  try {
    // Perform native timeout
    await targetMember.timeout(parsed.ms, `${reason} (Muted by ${executor.user.username})`);
    
    // Log action
    await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', `Muted (Timeout) for ${parsed.label}. Reason: ${reason}`);

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔇 Member Muted (Timeout)')
      .setDescription(`Successfully timed out **${targetUser.tag}** for **${parsed.label}**`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Mute] Error:', err.message);
    await interaction.editReply('⚠️ Failed to timeout member. Make sure I have Moderate Members permission.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to mute members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to mute: `.mute @user [duration: 5m/1h/2d] [reason]`');
  }

  const durationStr = args[1];
  const parsed = parseDuration(durationStr);
  if (!parsed) {
    return message.reply('❌ Please specify a valid duration string as second parameter: `.mute @user 5m [reason]`');
  }

  if (parsed.ms > 28 * 24 * 60 * 60 * 1000) {
    return message.reply('❌ Native Discord timeout duration cannot exceed 28 days. For permanent mutes, use `.permamute`.');
  }

  const reason = args.slice(2).join(' ') || 'No reason provided';
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) return message.reply('❌ User not found in server.');
  if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot mute owner.');
  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return message.reply('❌ Hierarchy error.');
  }
  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return message.reply('❌ I cannot mute this member.');
  }

  try {
    await targetMember.timeout(parsed.ms, `${reason} (Muted by ${executor.user.username})`);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', `Muted (Timeout) for ${parsed.label}. Reason: ${reason}`);

    return message.reply(`✅ Muted **${targetUser.username}** successfully with a Discord timeout for **${parsed.label}**. Reason: \`${reason}\``);
  } catch (err) {
    console.error('[Mute Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to mute member.');
  }
}
