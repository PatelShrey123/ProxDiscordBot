import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Play a song in your voice channel using remote Lavalink')
  .setDMPermission(false)
  .addStringOption(option =>
    option.setName('query')
      .setDescription('The song name, YouTube URL, or search query')
      .setRequired(true)
  );

export const queues = new Map(); // key: guildId, value: { player, textChannel, songs: [] }

// Version-immune helper to get connected/active Lavalink node from Shoukaku client
function getLavalinkNode(shoukaku) {
  if (!shoukaku) return null;
  
  // 1. Try getNode() method if it exists
  if (typeof shoukaku.getNode === 'function') {
    try {
      const node = shoukaku.getNode();
      if (node) return node;
    } catch {}
  }
  
  // 2. Try default nodeResolver if options exist
  if (shoukaku.options && typeof shoukaku.options.nodeResolver === 'function') {
    try {
      const node = shoukaku.options.nodeResolver(shoukaku.nodes);
      if (node) return node;
    } catch {}
  }

  // 3. Fallback to manual map check
  if (shoukaku.nodes && shoukaku.nodes.size > 0) {
    // Return first connected node if possible
    for (const node of shoukaku.nodes.values()) {
      if (node.state === 1 || node.state === 'CONNECTED') {
        return node;
      }
    }
    // Return any node as fallback
    return shoukaku.nodes.values().next().value;
  }
  
  return null;
}

async function playNext(guildId, client) {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    const node = getLavalinkNode(client.shoukaku);
    if (node) {
      await node.leaveChannel(guildId).catch(() => null);
    }
    queues.delete(guildId);
    if (queue.textChannel) {
      await queue.textChannel.send('🎶 Queue is empty. Left the voice channel.').catch(() => null);
    }
    return;
  }

  const song = queue.songs[0];
  try {
    const rawTrack = song.encoded || song.track;
    await queue.player.playTrack({ track: rawTrack });
    const embed = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle('🎶 Now Playing')
      .setDescription(`[${song.info.title}](${song.info.uri})`)
      .addFields(
        { name: 'Duration', value: `\`${formatDuration(song.info.length)}\``, inline: true },
        { name: 'Author', value: `\`${song.info.author}\``, inline: true }
      )
      .setTimestamp();
    await queue.textChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error('[Lavalink Play Error]:', err.message);
    queue.songs.shift();
    playNext(guildId, client);
  }
}

function formatDuration(ms) {
  if (!ms) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const member = interaction.member;
  const query = interaction.options.getString('query');

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.editReply('❌ You must join a voice channel first to play music.');
  }

  const node = getLavalinkNode(interaction.client.shoukaku);
  if (!node) {
    return interaction.editReply('⚠️ Lavalink connection is not ready. Please try again in a few seconds.');
  }

  try {
    let searchUrl = query.trim();
    if (!searchUrl.startsWith('http')) {
      searchUrl = `ytsearch:${searchUrl}`;
    }

    const result = await node.rest.resolve(searchUrl);
    if (!result || !result.data || (Array.isArray(result.data) && result.data.length === 0) || (result.data.tracks && result.data.tracks.length === 0)) {
      if (result.loadType === 'empty' || result.loadType === 'error') {
        return interaction.editReply('❌ No matches found for your query.');
      }
    }

    let track = null;
    let loadType = result.loadType;

    if (loadType === 'TRACK_LOADED' || loadType === 'track') {
      track = result.data || result.tracks[0];
    } else if (loadType === 'PLAYLIST_LOADED' || loadType === 'playlist') {
      const tracks = result.tracks || result.data.tracks;
      track = tracks[0];
    } else if (loadType === 'SEARCH_RESULT' || loadType === 'search') {
      const tracks = result.tracks || result.data.tracks || result.data;
      track = tracks[0];
    }

    if (!track) {
      return interaction.editReply('❌ No matches found for your query.');
    }

    let queue = queues.get(guild.id);

    if (!queue) {
      const player = await interaction.client.shoukaku.joinVoiceChannel({
        guildId: guild.id,
        channelId: voiceChannel.id,
        shardId: guild.shardId || 0,
        deaf: true
      });

      queue = {
        player,
        textChannel: interaction.channel,
        songs: []
      };

      queues.set(guild.id, queue);

      player.on('end', () => {
        queue.songs.shift();
        playNext(guild.id, interaction.client);
      });

      player.on('closed', () => {
        queues.delete(guild.id);
      });

      player.on('exception', (err) => {
        console.error('[Lavalink Player Exception]:', err);
      });
    }

    queue.songs.push(track);

    if (queue.songs.length === 1) {
      playNext(guild.id, interaction.client);
      return interaction.editReply(`🎶 Searching and playing: **${track.info.title}**`);
    } else {
      return interaction.editReply(`✅ Added to queue: **${track.info.title}** (Position: #${queue.songs.length - 1})`);
    }
  } catch (err) {
    console.error('[Music Execute Error]:', err.message);
    return interaction.editReply('⚠️ Failed to resolve or play the track.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const member = message.member;
  const query = args.join(' ');

  if (!query) {
    return message.reply('❌ Please specify a song name or YouTube link to play: `.music <songname/link>`');
  }

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return message.reply('❌ You must join a voice channel first to play music.');
  }

  const node = getLavalinkNode(message.client.shoukaku);
  if (!node) {
    return message.reply('⚠️ Lavalink connection is not ready. Please try again in a few seconds.');
  }

  try {
    let searchUrl = query.trim();
    if (!searchUrl.startsWith('http')) {
      searchUrl = `ytsearch:${searchUrl}`;
    }

    const result = await node.rest.resolve(searchUrl);
    let track = null;
    let loadType = result.loadType;

    if (loadType === 'TRACK_LOADED' || loadType === 'track') {
      track = result.data || result.tracks[0];
    } else if (loadType === 'PLAYLIST_LOADED' || loadType === 'playlist') {
      const tracks = result.tracks || result.data.tracks;
      track = tracks[0];
    } else if (loadType === 'SEARCH_RESULT' || loadType === 'search') {
      const tracks = result.tracks || result.data.tracks || result.data;
      track = tracks[0];
    }

    if (!track) {
      return message.reply('❌ No matches found for your query.');
    }

    let queue = queues.get(guild.id);

    if (!queue) {
      const player = await message.client.shoukaku.joinVoiceChannel({
        guildId: guild.id,
        channelId: voiceChannel.id,
        shardId: guild.shardId || 0,
        deaf: true
      });

      queue = {
        player,
        textChannel: message.channel,
        songs: []
      };

      queues.set(guild.id, queue);

      player.on('end', () => {
        queue.songs.shift();
        playNext(guild.id, message.client);
      });

      player.on('closed', () => {
        queues.delete(guild.id);
      });
    }

    queue.songs.push(track);

    if (queue.songs.length === 1) {
      playNext(guild.id, message.client);
      return message.reply(`🎶 Searching and playing: **${track.info.title}**`);
    } else {
      return message.reply(`✅ Added to queue: **${track.info.title}** (Position: #${queue.songs.length - 1})`);
    }
  } catch (err) {
    console.error('[Music Prefix Error]:', err.message);
    return message.reply('⚠️ Failed to resolve or play the track.');
  }
}
