import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getUserWarns, getUserWarnCount } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('warnhistory')
  .setDescription('View the warning history of a user')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The user to view warnings for')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Must have ModerateMembers permission
  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to view warning history.');
  }

  try {
    const warns = await getUserWarns(guild.id, targetUser.id);
    const totalWarns = await getUserWarnCount(guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle(`📋 Warning History: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(`Current Warnings: **${totalWarns} / 5**`)
      .setTimestamp();

    if (warns.length === 0) {
      embed.setDescription('✅ This user has no active warnings in this server.');
    } else {
      const fields = await Promise.all(warns.map(async (warn, index) => {
        const dateStr = new Date(warn.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const modUser = await interaction.client.users.fetch(warn.moderator_id).catch(() => null);
        const modName = modUser ? `${modUser.username}` : `ID: ${warn.moderator_id}`;
        return {
          name: `${index + 1}. ⚠️ Warning — ${dateStr}`,
          value: `**Reason:** \`${warn.reason}\`\n**Moderator:** \`${modName}\``
        };
      }));
      embed.addFields(fields);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[WarnHistory Command Error]:', err.message);
    await interaction.editReply('⚠️ Failed to fetch warning history from database.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to view warning history.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user: `.warnhistory @user` or `.warnhistory [user_id]`');
  }

  try {
    const warns = await getUserWarns(guild.id, targetUser.id);
    const totalWarns = await getUserWarnCount(guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle(`📋 Warning History: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(`Current Warnings: **${totalWarns} / 5**`)
      .setTimestamp();

    if (warns.length === 0) {
      embed.setDescription('✅ This user has no active warnings in this server.');
    } else {
      const fields = await Promise.all(warns.map(async (warn, index) => {
        const dateStr = new Date(warn.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const modUser = await message.client.users.fetch(warn.moderator_id).catch(() => null);
        const modName = modUser ? `${modUser.username}` : `ID: ${warn.moderator_id}`;
        return {
          name: `${index + 1}. ⚠️ Warning — ${dateStr}`,
          value: `**Reason:** \`${warn.reason}\`\n**Moderator:** \`${modName}\``
        };
      }));
      embed.addFields(fields);
    }

    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[WarnHistory Prefix Error]:', err.message);
    return message.reply('⚠️ Failed to fetch warning history.');
  }
}
