import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getOrCreateQueue, getQueue } from '../utils/musicManager.js';

export const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Control music playback in your voice channel')
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand.setName('play')
      .setDescription('Play a song from Youtube URL or search term')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Song title or YouTube link')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('skip')
      .setDescription('Skip the current song')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('stop')
      .setDescription('Stop music playback and disconnect')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('queue')
      .setDescription('Display the current song queue')
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const member = interaction.member;

  // Verify voice channel
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.editReply('❌ You must be in a voice channel to use music commands.');
  }

  if (subcommand === 'play') {
    const query = interaction.options.getString('query');
    const queue = getOrCreateQueue(guild.id, voiceChannel);

    const song = {
      title: query,
      url: query,
      requester: member.user.tag
    };

    await queue.play(song);

    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle('🎵 Music Player')
      .setDescription(`Added **${song.title}** to queue.`)
      .setFooter({ text: `Requested by ${song.requester}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else if (subcommand === 'skip') {
    const queue = getQueue(guild.id);
    if (!queue || !queue.playing) {
      return interaction.editReply('❌ No music is currently playing in this server.');
    }

    const skipped = queue.skip();
    if (skipped) {
      await interaction.editReply('⏭️ Skipped current song.');
    } else {
      await interaction.editReply('⏹️ Skipped current song and stopped playback (end of queue).');
    }
  } else if (subcommand === 'stop') {
    const queue = getQueue(guild.id);
    if (!queue) {
      return interaction.editReply('❌ No active music connection in this server.');
    }

    queue.stop();
    await interaction.editReply('⏹️ Stopped music playback and disconnected from voice channel.');
  } else if (subcommand === 'queue') {
    const queue = getQueue(guild.id);
    if (!queue || queue.songs.length === 0) {
      return interaction.editReply('ℹ️ The queue is currently empty.');
    }

    const list = queue.songs.map((s, idx) => `${idx === 0 ? '▶' : `${idx}.`} **${s.title}**`).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle('🎵 Current Music Queue')
      .setDescription(list)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export async function executePrefix(message, args, overrideCmd = null) {
  const member = message.member;
  const guild = message.guild;

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return message.reply('❌ You must be in a voice channel to play music.');
  }

  const cmd = overrideCmd || args[0]?.toLowerCase();
  
  if (cmd === 'play' || message.content.toLowerCase().startsWith('.play')) {
    const query = overrideCmd ? args.join(' ') : args.slice(1).join(' ');
    if (!query) {
      return message.reply('❌ Please specify a song URL or search query: `.play [song]`');
    }

    const queue = getOrCreateQueue(guild.id, voiceChannel);
    const song = {
      title: query,
      url: query,
      requester: member.user.tag
    };

    await queue.play(song);
    return message.reply(`🎵 Added **${song.title}** to queue.`);
  } else if (cmd === 'skip' || message.content.toLowerCase().startsWith('.skip')) {
    const queue = getQueue(guild.id);
    if (!queue || !queue.playing) return message.reply('❌ No music playing.');

    const skipped = queue.skip();
    return message.reply(skipped ? '⏭️ Skipped current song.' : '⏹️ Queue ended.');
  } else if (cmd === 'stop' || message.content.toLowerCase().startsWith('.stop')) {
    const queue = getQueue(guild.id);
    if (!queue) return message.reply('❌ No active connection.');
    queue.stop();
    return message.reply('⏹️ Stopped and disconnected.');
  } else if (cmd === 'queue' || message.content.toLowerCase().startsWith('.queue')) {
    const queue = getQueue(guild.id);
    if (!queue || queue.songs.length === 0) return message.reply('ℹ️ The queue is empty.');

    const list = queue.songs.map((s, idx) => `${idx === 0 ? '▶' : `${idx}.`} **${s.title}**`).join('\n');
    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle('🎵 Current Music Queue')
      .setDescription(list);
    return message.reply({ embeds: [embed] });
  }
}
