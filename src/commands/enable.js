import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setLevelTrackingStatus } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('enable')
  .setDescription('Enable bot features')
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand
      .setName('level')
      .setDescription('Enable leveling/yap XP tracking for this server')
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only Server Owner or Manage Guild
  const isOwner = executor.id === guild.ownerId;
  const hasManageGuild = executor.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !hasManageGuild) {
    return interaction.editReply('❌ Only the server owner or members with `Manage Guild` permission can enable features.');
  }

  if (subcommand === 'level') {
    const success = await setLevelTrackingStatus(guild.id, true);
    if (success) {
      return interaction.editReply('✅ Successfully **enabled** leveling/yap XP tracking for this server.');
    } else {
      return interaction.editReply('⚠️ Failed to update setting in database.');
    }
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  const isOwner = executor.id === guild.ownerId;
  const hasManageGuild = executor.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !hasManageGuild) {
    return message.reply('❌ Only the server owner or members with `Manage Guild` permission can enable features.');
  }

  const sub = args[0]?.toLowerCase();
  if (sub !== 'level') {
    return message.reply('❌ Please specify a feature to enable, e.g. `.enable level`');
  }

  const success = await setLevelTrackingStatus(guild.id, true);
  if (success) {
    return message.reply('✅ Successfully **enabled** leveling/yap XP tracking for this server.');
  } else {
    return message.reply('⚠️ Failed to update settings in database.');
  }
}
