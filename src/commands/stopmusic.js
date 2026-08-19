import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { queues, deleteQueue } from './music.js';
import { recordTrackPlay } from '../utils/musicStatsManager.js';

export const data = new SlashCommandBuilder()
  .setName('stopmusic')
  .setDescription('Stop the music, clear the queue, and leave the voice channel')
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const member = interaction.member;

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.editReply('❌ You must be in a voice channel to stop the music.');
  }

  const queue = queues.get(guild.id);
  if (!queue) {
    return interaction.editReply('❌ No music is currently playing in this server.');
  }

  try {
    // Record play stats before clearing
    if (queue.songs[0]) {
      recordTrackPlay(guild.id, queue.songs[0], interaction.client);
    }
    // Clear queue songs
    queue.songs = [];
    
    // Leave Voice Channel
    await interaction.client.shoukaku.leaveVoiceChannel(guild.id).catch(() => null);
    
    // Delete queue record and clear timers/intervals
    deleteQueue(guild.id);

    return interaction.editReply('⏹️ Music has been stopped and the queue cleared.');
  } catch (err) {
    console.error('[StopMusic Error]:', err.message);
    return interaction.editReply('⚠️ An error occurred while trying to stop the music.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const member = message.member;

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return message.reply('❌ You must be in a voice channel to stop the music.');
  }

  const queue = queues.get(guild.id);
  if (!queue) {
    return message.reply('❌ No music is currently playing in this server.');
  }

  try {
    if (queue.songs[0]) {
      recordTrackPlay(guild.id, queue.songs[0], message.client);
    }
    queue.songs = [];
    await message.client.shoukaku.leaveVoiceChannel(guild.id).catch(() => null);
    deleteQueue(guild.id);
    return message.reply('⏹️ Music has been stopped and the queue cleared.');
  } catch (err) {
    console.error('[StopMusic Prefix Error]:', err.message);
    return message.reply('⚠️ Failed to stop the music.');
  }
}
