import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { setLevelChannel } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('levelchannel')
  .setDescription('Set or reset the custom level-up announcement channel')
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub.setName('set')
      .setDescription('Set the level-up channel')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('The channel where level-up messages will be posted')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('reset')
      .setDescription('Reset the level-up channel to fallback search')
  );

async function resolveChannel(guild, input) {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Check for Channel URL: https://discord.com/channels/.../...
  const urlRegex = /https:\/\/discord\.com\/channels\/\d+\/(\d+)/i;
  const urlMatch = trimmed.match(urlRegex);
  if (urlMatch) return await guild.channels.fetch(urlMatch[1]).catch(() => null);

  // 2. Check for Mention: <#1534201975497822228>
  const mentionRegex = /^<#(\d+)>$/;
  const mentionMatch = trimmed.match(mentionRegex);
  if (mentionMatch) return await guild.channels.fetch(mentionMatch[1]).catch(() => null);

  // 3. Check for Raw ID
  const idRegex = /^\d+$/;
  if (idRegex.test(trimmed)) return await guild.channels.fetch(trimmed).catch(() => null);

  // 4. Try resolving by name (strip leading #)
  let nameQuery = trimmed;
  if (nameQuery.startsWith('#')) {
    nameQuery = nameQuery.slice(1).trim();
  }
  return guild.channels.cache.find(c => 
    c.name.toLowerCase() === nameQuery.toLowerCase() && c.type === 0
  ) || null;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only administrators or users with Manage Server
  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply('❌ You do not have permission to configure the level-up channel.');
  }

  const sub = interaction.options.getSubcommand();

  try {
    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel');
      if (!channel.isTextBased()) {
        return interaction.editReply('❌ Please select a text-based channel.');
      }
      const success = await setLevelChannel(guild.id, channel.id);
      if (!success) throw new Error('Database update failed');
      return interaction.editReply(`✅ **Level-up announcement channel** has been set to ${channel}.`);
    }

    if (sub === 'reset') {
      const success = await setLevelChannel(guild.id, null);
      if (!success) throw new Error('Database update failed');
      return interaction.editReply('✅ **Level-up announcement channel** has been reset. The bot will now search for a channel named `level-up` dynamically.');
    }
  } catch (err) {
    console.error('[LevelChannel Execute] Error:', err.message);
    return interaction.editReply('⚠️ Failed to update level channel in the database. Please verify the `level_up_channel_id` column exists in Supabase.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply('❌ You do not have permission to configure the level-up channel.');
  }

  const param = args[0]?.toLowerCase();
  if (!param) {
    return message.reply('❌ Usage: `.levelchannel <#channel/channel-link/channel-id>` or `.levelchannel reset`');
  }

  try {
    if (param === 'reset') {
      const success = await setLevelChannel(guild.id, null);
      if (!success) throw new Error('Database error');
      return message.reply('✅ **Level-up announcement channel** has been reset. The bot will now search for a channel named `level-up` dynamically.');
    }

    const channelParam = args.join(' ');
    const channel = await resolveChannel(guild, channelParam);
    if (!channel) {
      return message.reply('❌ Please specify a valid text channel, mention, channel ID, or channel link: `.levelchannel #channel-name` or `.levelchannel https://discord.com/channels/.../...`');
    }
    if (!channel.isTextBased()) {
      return message.reply('❌ Please specify a text-based channel.');
    }
    const success = await setLevelChannel(guild.id, channel.id);
    if (!success) throw new Error('Database error');
    return message.reply(`✅ **Level-up announcement channel** has been set to ${channel}.`);
  } catch (err) {
    console.error('[LevelChannel Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to update level-up channel setting. Make sure the database column exists.');
  }
}
