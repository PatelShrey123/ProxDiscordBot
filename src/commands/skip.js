import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { queues } from './music.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the currently playing song')
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const member = interaction.member;
  const user = interaction.user;

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.editReply('❌ You must join a voice channel first to skip music.');
  }

  const queue = queues.get(guild.id);
  if (!queue || queue.songs.length === 0) {
    return interaction.editReply('❌ No music is currently playing in this server.');
  }

  // Check if the user is in the same voice channel as the bot
  const botVoiceChannel = guild.members.me?.voice.channel;
  if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id) {
    return interaction.editReply('❌ You must be in the same voice channel as the bot to skip music.');
  }

  const song = queue.songs[0];
  const requester = song.requestedBy;

  // Check if user is the requester or has mod/admin permissions
  const isRequester = requester && user.id === requester.id;
  const isMod = member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                member.permissions.has(PermissionFlagsBits.Administrator);

  if (isRequester || isMod) {
    try {
      queue.player.stop();
      return interaction.editReply(`⏭️ **${song.info.title}** was skipped by **${user.username}**!`);
    } catch (err) {
      console.error('[Skip Command Error]:', err.message);
      return interaction.editReply('⚠️ An error occurred while trying to skip the track.');
    }
  }

  // Voting Logic
  const activeMembers = voiceChannel.members.filter(m => !m.user.bot);
  const totalListeners = activeMembers.size;
  const requiredVotes = Math.ceil(totalListeners / 2);

  if (queue.voters.has(user.id)) {
    return interaction.editReply(`⚠️ You have already voted to skip this song! (Current votes: **${queue.voters.size}/${requiredVotes}**)`);
  }

  queue.voters.add(user.id);

  if (queue.voters.size >= requiredVotes) {
    try {
      queue.player.stop();
      return interaction.editReply(`⏭️ **${song.info.title}** was skipped! (Majority vote reached: **${queue.voters.size}/${totalListeners}** votes)`);
    } catch (err) {
      console.error('[Skip Vote Skip Error]:', err.message);
      return interaction.editReply('⚠️ An error occurred while trying to skip the track.');
    }
  } else {
    return interaction.editReply(`🗳️ Vote registered! **${user.username}** wants to skip. (Current votes: **${queue.voters.size}/${requiredVotes}** votes)`);
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const member = message.member;
  const user = message.author;

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return message.reply('❌ You must join a voice channel first to skip music.');
  }

  const queue = queues.get(guild.id);
  if (!queue || queue.songs.length === 0) {
    return message.reply('❌ No music is currently playing in this server.');
  }

  const botVoiceChannel = guild.members.me?.voice.channel;
  if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id) {
    return message.reply('❌ You must be in the same voice channel as the bot to skip music.');
  }

  const song = queue.songs[0];
  const requester = song.requestedBy;

  const isRequester = requester && user.id === requester.id;
  const isMod = member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                member.permissions.has(PermissionFlagsBits.Administrator);

  if (isRequester || isMod) {
    try {
      queue.player.stop();
      return message.reply(`⏭️ **${song.info.title}** was skipped by **${user.username}**!`);
    } catch (err) {
      console.error('[Skip Prefix Error]:', err.message);
      return message.reply('⚠️ Failed to skip the track.');
    }
  }

  const activeMembers = voiceChannel.members.filter(m => !m.user.bot);
  const totalListeners = activeMembers.size;
  const requiredVotes = Math.ceil(totalListeners / 2);

  if (queue.voters.has(user.id)) {
    return message.reply(`⚠️ You have already voted to skip this song! (Current votes: **${queue.voters.size}/${requiredVotes}**)`);
  }

  queue.voters.add(user.id);

  if (queue.voters.size >= requiredVotes) {
    try {
      queue.player.stop();
      return message.reply(`⏭️ **${song.info.title}** was skipped! (Majority vote reached: **${queue.voters.size}/${totalListeners}** votes)`);
    } catch (err) {
      console.error('[Skip Prefix Vote Error]:', err.message);
      return message.reply('⚠️ Failed to skip the track.');
    }
  } else {
    return message.reply(`🗳️ Vote registered! **${user.username}** wants to skip. (Current votes: **${queue.voters.size}/${requiredVotes}** votes)`);
  }
}
