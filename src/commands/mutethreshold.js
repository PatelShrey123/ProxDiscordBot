import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { updateMuteSettings, getMuteSettings } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('mutethreshold')
  .setDescription('Set the maximum number of mutes a user can get before being automatically banned')
  .setDMPermission(false)
  .addIntegerOption(opt =>
    opt.setName('limit')
      .setDescription('Number of mutes before auto-ban (default: 5)')
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only administrators or users with Manage Server
  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply('❌ You do not have permission to configure the mute threshold.');
  }

  const limit = interaction.options.getInteger('limit');

  try {
    const success = await updateMuteSettings(guild.id, { mute_threshold: limit });
    if (!success) throw new Error('Database update failed');
    return interaction.editReply(`✅ **Mute threshold** has been set to **${limit}** mutes. If a user hits this threshold, they will be automatically banned!`);
  } catch (err) {
    console.error('[MuteThreshold Execute] Error:', err.message);
    return interaction.editReply('⚠️ Failed to update mute threshold in the database.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply('❌ You do not have permission to configure the mute threshold.');
  }

  const limitParam = args[0];
  if (!limitParam) {
    // Show current threshold
    try {
      const { mute_threshold } = await getMuteSettings(guild.id);
      return message.reply(`ℹ️ The current **mute threshold** is set to **${mute_threshold}** mutes.`);
    } catch (err) {
      return message.reply('❌ Usage: `.mutethreshold <number>`');
    }
  }

  const limit = parseInt(limitParam);
  if (isNaN(limit) || limit < 1) {
    return message.reply('❌ Please specify a valid positive number greater than 0: `.mutethreshold 5`');
  }

  try {
    const success = await updateMuteSettings(guild.id, { mute_threshold: limit });
    if (!success) throw new Error('Database error');
    return message.reply(`✅ **Mute threshold** has been set to **${limit}** mutes. If a user hits this threshold, they will be automatically banned!`);
  } catch (err) {
    console.error('[MuteThreshold Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to update mute threshold setting.');
  }
}
