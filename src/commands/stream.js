import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('stream')
  .setDescription('Generate a voice channel deep-link to quickly join and start streaming')
  .setDMPermission(false)
  .addStringOption(option =>
    option.setName('channel')
      .setDescription('Voice channel name, ID, link, or mention (leave blank to use your current VC)')
      .setRequired(false)
  );

async function resolveChannel(guild, input) {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Check for Channel URL: https://discord.com/channels/1370737081361502278/1406553438535422033
  const urlRegex = /https:\/\/discord\.com\/channels\/\d+\/(\d+)/i;
  const urlMatch = trimmed.match(urlRegex);
  if (urlMatch) return await guild.channels.fetch(urlMatch[1]).catch(() => null);

  // 2. Check for Mention: <#1406553438535422033>
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
    c.name.toLowerCase() === nameQuery.toLowerCase() && c.isVoiceBased()
  ) || null;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const executor = interaction.member;
  const channelParam = interaction.options.getString('channel');

  let voiceChannel = null;

  try {
    if (channelParam) {
      voiceChannel = await resolveChannel(guild, channelParam);
      if (!voiceChannel) {
        return interaction.editReply('❌ Could not find the specified channel. Please provide a valid voice channel name, ID, link, or mention.');
      }
      if (!voiceChannel.isVoiceBased()) {
        return interaction.editReply('❌ The specified channel is not a voice channel.');
      }
    } else {
      voiceChannel = executor.voice.channel;
      if (!voiceChannel) {
        return interaction.editReply('❌ You are not in a voice channel. Please join one first or specify a channel: `/stream channel:#voice-channel`');
      }
    }

    const streamLink = `https://discord.com/channels/${guild.id}/${voiceChannel.id}`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2') // Discord blurple color
      .setTitle('🎥 Quick Stream Link')
      .setDescription(`Click the link below to drop into **${voiceChannel.name}** and start streaming your screen instantly!`)
      .addFields(
        { name: 'Join & Go Live', value: `🔗 **[Click here to Stream](${streamLink})**` }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Stream Command Error]:', err.message);
    return interaction.editReply('⚠️ An error occurred while generating the stream link.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;
  const channelParam = args.join(' ');

  let voiceChannel = null;

  try {
    if (channelParam) {
      voiceChannel = await resolveChannel(guild, channelParam);
      if (!voiceChannel) {
        return message.reply('❌ Could not find the specified voice channel. Provide a valid name, ID, link, or mention.');
      }
      if (!voiceChannel.isVoiceBased()) {
        return message.reply('❌ The specified channel is not a voice channel.');
      }
    } else {
      voiceChannel = executor.voice.channel;
      if (!voiceChannel) {
        return message.reply('❌ You are not in a voice channel. Please join one first or specify a channel: `.stream #voice-channel`');
      }
    }

    const streamLink = `https://discord.com/channels/${guild.id}/${voiceChannel.id}`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎥 Quick Stream Link')
      .setDescription(`Click the link below to drop into **${voiceChannel.name}** and start streaming your screen instantly!`)
      .addFields(
        { name: 'Join & Go Live', value: `🔗 **[Click here to Stream](${streamLink})**` }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[Stream Prefix Command Error]:', err.message);
    return message.reply('⚠️ Failed to generate stream link.');
  }
}
