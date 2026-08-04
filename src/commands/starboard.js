import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { updateStarboardSettings, getGuildSettings } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Configure the starboard system')
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub.setName('channel')
      .setDescription('Set the starboard channel')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('The channel where starred messages will be posted')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('Enable or disable the starboard system')
      .addBooleanOption(opt =>
        opt.setName('enabled')
          .setDescription('Whether the starboard is enabled')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('threshold')
      .setDescription('Set how many star reactions are required to get on the starboard')
      .addIntegerOption(opt =>
        opt.setName('count')
          .setDescription('Minimum star reactions required (default is 5)')
          .setRequired(true)
          .setMinValue(1)
      )
  );

function resolveChannelId(input) {
  if (!input) return null;
  // 1. Check for Channel URL: https://discord.com/channels/1493633686506049566/1534201975497822228
  const urlRegex = /https:\/\/discord\.com\/channels\/\d+\/(\d+)/i;
  const urlMatch = input.match(urlRegex);
  if (urlMatch) return urlMatch[1];

  // 2. Check for Mention: <#1534201975497822228>
  const mentionRegex = /^<#(\d+)>$/;
  const mentionMatch = input.match(mentionRegex);
  if (mentionMatch) return mentionMatch[1];

  // 3. Check for Raw ID
  const idRegex = /^\d+$/;
  if (idRegex.test(input)) return input;

  return null;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only administrators or users with Manage Server
  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply('❌ You do not have permission to configure the starboard.');
  }

  const sub = interaction.options.getSubcommand();

  try {
    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel.isTextBased()) {
        return interaction.editReply('❌ Please select a text-based channel.');
      }
      const success = await updateStarboardSettings(guild.id, { starboard_channel_id: channel.id });
      if (!success) throw new Error('Database update failed');
      return interaction.editReply(`✅ **Starboard channel** has been set to ${channel}.`);
    }

    if (sub === 'status') {
      const enabled = interaction.options.getBoolean('enabled');
      const success = await updateStarboardSettings(guild.id, { starboard_enabled: enabled });
      if (!success) throw new Error('Database update failed');
      return interaction.editReply(`✅ **Starboard system** has been ${enabled ? 'enabled' : 'disabled'}.`);
    }

    if (sub === 'threshold') {
      const count = interaction.options.getInteger('count');
      const success = await updateStarboardSettings(guild.id, { starboard_threshold: count });
      if (!success) throw new Error('Database update failed');
      return interaction.editReply(`✅ **Starboard reaction threshold** has been set to **${count}** stars.`);
    }
  } catch (err) {
    console.error('[Starboard Execute] Error:', err.message);
    return interaction.editReply('⚠️ Failed to update starboard settings in the database. Please verify the settings columns exist in Supabase.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply('❌ You do not have permission to configure the starboard.');
  }

  const sub = args[0]?.toLowerCase();
  if (!sub || !['channel', 'status', 'threshold'].includes(sub)) {
    return message.reply('❌ Usage: `.starboard channel <#channel/channel-link/channel-id>` or `.starboard status <enable/disable>` or `.starboard threshold <number>`');
  }

  try {
    if (sub === 'channel') {
      const channelParam = args[1];
      const channelId = resolveChannelId(channelParam);
      
      const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
      if (!channel) {
        return message.reply('❌ Please specify a valid text channel, mention, channel ID, or channel link: `.starboard channel #channel-name` or `.starboard channel https://discord.com/channels/.../...`');
      }
      if (!channel.isTextBased()) {
        return message.reply('❌ Please specify a text-based channel.');
      }
      const success = await updateStarboardSettings(guild.id, { starboard_channel_id: channel.id });
      if (!success) throw new Error('Database error');
      return message.reply(`✅ **Starboard channel** has been set to ${channel}.`);
    }

    if (sub === 'status') {
      const val = args[1]?.toLowerCase();
      if (!val || !['enable', 'disable', 'true', 'false', 'on', 'off'].includes(val)) {
        return message.reply('❌ Usage: `.starboard status <enable/disable>`');
      }
      const enabled = ['enable', 'true', 'on'].includes(val);
      const success = await updateStarboardSettings(guild.id, { starboard_enabled: enabled });
      if (!success) throw new Error('Database error');
      return message.reply(`✅ **Starboard system** has been ${enabled ? 'enabled' : 'disabled'}.`);
    }

    if (sub === 'threshold') {
      const count = parseInt(args[1]);
      if (isNaN(count) || count < 1) {
        return message.reply('❌ Please specify a valid threshold number greater than 0: `.starboard threshold 5`');
      }
      const success = await updateStarboardSettings(guild.id, { starboard_threshold: count });
      if (!success) throw new Error('Database error');
      return message.reply(`✅ **Starboard reaction threshold** has been set to **${count}** stars.`);
    }
  } catch (err) {
    console.error('[Starboard Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to update starboard settings. Make sure the database columns exist.');
  }
}
