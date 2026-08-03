import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getModeratorActions } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('modreview')
  .setDescription('View the last 3 moderation actions performed by a moderator')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The moderator to review')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;

  // Permissions Check: Only administrators or high-level mods can review other mods!
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to review moderator history.');
  }

  try {
    const logs = await getModeratorActions(guild.id, targetUser.id, 3);
    
    const embed = new EmbedBuilder()
      .setColor('#0ea5e9')
      .setTitle(`📋 Moderator Review: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (logs.length === 0) {
      embed.setDescription('ℹ️ No logged moderation actions found for this user.');
    } else {
      const fields = await Promise.all(logs.map(async (log, index) => {
        const actionEmoji = log.action === 'BAN' ? '🔨' : log.action === 'KICK' ? '👢' : log.action === 'MUTE' ? '🔇' : log.action === 'PERMAMUTE' ? '🔇🔒' : '⚖️';
        const dateStr = new Date(log.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const targetMember = await interaction.client.users.fetch(log.user_id).catch(() => null);
        const targetName = targetMember ? `${targetMember.username}` : `ID: ${log.user_id}`;
        return {
          name: `${index + 1}. ${actionEmoji} ${log.action} — ${dateStr}`,
          value: `**Target:** \`${targetName}\`\n**Reason:** \`${log.reason}\``
        };
      }));
      embed.addFields(fields);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[ModReview] Error:', err.message);
    await interaction.editReply('⚠️ Failed to fetch moderator history logs from database.');
  }
}

export async function executePrefix(message, args) {
  const executor = message.member;
  const guild = message.guild;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to review moderator history.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a moderator: `.modreview @moderator` or `.modreview [user_id]`');
  }

  try {
    const logs = await getModeratorActions(guild.id, targetUser.id, 3);
    
    const embed = new EmbedBuilder()
      .setColor('#0ea5e9')
      .setTitle(`📋 Moderator Review: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (logs.length === 0) {
      embed.setDescription('ℹ️ No logged moderation actions found for this user.');
    } else {
      const fields = await Promise.all(logs.map(async (log, index) => {
        const actionEmoji = log.action === 'BAN' ? '🔨' : log.action === 'KICK' ? '👢' : log.action === 'MUTE' ? '🔇' : log.action === 'PERMAMUTE' ? '🔇🔒' : '⚖️';
        const dateStr = new Date(log.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const targetMember = await message.client.users.fetch(log.user_id).catch(() => null);
        const targetName = targetMember ? `${targetMember.username}` : `ID: ${log.user_id}`;
        return {
          name: `${index + 1}. ${actionEmoji} ${log.action} — ${dateStr}`,
          value: `**Target:** \`${targetName}\`\n**Reason:** \`${log.reason}\``
        };
      }));
      embed.addFields(fields);
    }

    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[ModReview Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to fetch moderator review logs.');
  }
}
