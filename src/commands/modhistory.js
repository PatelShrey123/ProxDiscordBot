import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getModerationHistory } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('modhistory')
  .setDescription('View the last 10 moderation log entries of a user')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The user to view history for')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;

  // Permissions Check: Only moderators can view mod history!
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to view moderation history.');
  }

  try {
    const logs = await getModerationHistory(guild.id, targetUser.id, 10);
    
    const embed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle(`🛡️ Moderation History: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (logs.length === 0) {
      embed.setDescription('✅ No moderation history logs found for this user.');
    } else {
      const fields = await Promise.all(logs.map(async (log, index) => {
        const actionEmoji = log.action === 'BAN' ? '🔨' : log.action === 'KICK' ? '👢' : log.action === 'MUTE' ? '🔇' : '⚖️';
        const dateStr = new Date(log.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const modUser = await interaction.client.users.fetch(log.moderator_id).catch(() => null);
        const modName = modUser ? `${modUser.username}` : `ID: ${log.moderator_id}`;
        return {
          name: `${index + 1}. ${actionEmoji} ${log.action} — ${dateStr}`,
          value: `**Reason:** \`${log.reason}\`\n**Moderator:** \`${modName}\``
        };
      }));
      embed.addFields(fields);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[ModHistory] Error:', err.message);
    await interaction.editReply('⚠️ Failed to fetch moderation history logs from database.');
  }
}

export async function executePrefix(message, args) {
  const executor = message.member;
  const guild = message.guild;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to view moderation history.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user: `.modhistory @user` or `.modhistory [user_id]`');
  }

  try {
    const logs = await getModerationHistory(guild.id, targetUser.id, 10);
    
    const embed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle(`🛡️ Moderation History: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (logs.length === 0) {
      embed.setDescription('✅ No moderation history logs found for this user.');
    } else {
      const fields = await Promise.all(logs.map(async (log, index) => {
        const actionEmoji = log.action === 'BAN' ? '🔨' : log.action === 'KICK' ? '👢' : log.action === 'MUTE' ? '🔇' : '⚖️';
        const dateStr = new Date(log.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const modUser = await message.client.users.fetch(log.moderator_id).catch(() => null);
        const modName = modUser ? `${modUser.username}` : `ID: ${log.moderator_id}`;
        return {
          name: `${index + 1}. ${actionEmoji} ${log.action} — ${dateStr}`,
          value: `**Reason:** \`${log.reason}\`\n**Moderator:** \`${modName}\``
        };
      }));
      embed.addFields(fields);
    }

    await message.reply({ embeds: [embed] });
  } catch {
    return message.reply('⚠️ Failed to fetch moderation history.');
  }
}
