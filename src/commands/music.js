import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import play from 'play-dl';

export const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Play a song in your voice channel directly')
  .setDMPermission(false)
  .addStringOption(option =>
    option.setName('query')
      .setDescription('The song name, YouTube URL, or search query')
      .setRequired(true)
  );

export const queues = new Map(); // key: guildId, value: { player, connection, textChannel, songs: [], voters: Set }

async function playNext(guildId, client) {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    if (queue.textChannel) {
      await queue.textChannel.send('🎶 Queue is empty. The bot will disconnect in 3 minutes if no new songs are added.').catch(() => null);
    }
    queue.inactivityTimeout = setTimeout(async () => {
      if (queue.connection) {
        queue.connection.destroy();
      }
      queues.delete(guildId);
      if (queue.textChannel) {
        await queue.textChannel.send('🎶 Disconnected from voice channel due to inactivity.').catch(() => null);
      }
    }, 3 * 60 * 1000);
    return;
  }

  // Reset voters for the new song
  if (queue.voters) {
    queue.voters.clear();
  }

  const song = queue.songs[0];
  try {
    const stream = await play.stream(song.info.uri);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });
    
    queue.player.play(resource);
    
    const embed = new EmbedBuilder()
      .setColor('#1db954')
      .setTitle('🎶 Now Playing')
      .setDescription(`[${song.info.title}](${song.info.uri})`)
      .setThumbnail(song.info.artworkUrl)
      .addFields(
        { name: 'Track Length', value: `\`${formatDuration(song.info.length)}\``, inline: true },
        { name: 'Author', value: `\`${song.info.author}\``, inline: true }
      )
      .setTimestamp();

    if (song.requestedBy) {
      embed.setFooter({ text: `Requested by ${song.requestedBy.tag}`, iconURL: song.requestedBy.displayAvatarURL() });
    }

    await (song.textChannel || queue.textChannel).send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error('[Direct Play Error Details]:', err);
    if (queue.textChannel) {
      await queue.textChannel.send(`⚠️ Error playing **${song.info.title}**: ${err.message}`).catch(() => null);
    }
    queue.songs.shift();
    playNext(guildId, client);
  }
}

function formatDuration(ms) {
  if (!ms) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function resolveTracks(query) {
  const type = await play.validate(query);
  let tracks = [];
  let playlistName = null;

  if (type === 'yt_playlist') {
    const playlist = await play.playlist_info(query, { incomplete: true });
    const playlistVideos = await playlist.all_videos();
    tracks = playlistVideos.map(video => ({
      info: {
        title: video.title,
        uri: video.url,
        length: video.durationInSec * 1000,
        author: video.channel?.name || 'Unknown Author',
        identifier: video.id,
        artworkUrl: video.thumbnails[0]?.url
      }
    }));
    playlistName = playlist.title;
  } else if (type === 'yt_video') {
    const video = await play.video_info(query);
    const videoInfo = video.video_details;
    tracks = [{
      info: {
        title: videoInfo.title,
        uri: videoInfo.url,
        length: videoInfo.durationInSec * 1000,
        author: videoInfo.channel?.name || 'Unknown Author',
        identifier: videoInfo.id,
        artworkUrl: videoInfo.thumbnails[0]?.url
      }
    }];
  } else if (type && (type.startsWith('sp_') || type.startsWith('spotify'))) {
    if (play.is_spotify_pie()) {
      const spotifyData = await play.spotify(query);
      if (spotifyData.type === 'track') {
        const searchResult = await play.search(`${spotifyData.name} ${spotifyData.artists[0]?.name}`, { limit: 1 });
        if (searchResult.length > 0) {
          const video = searchResult[0];
          tracks = [{
            info: {
              title: spotifyData.name,
              uri: video.url,
              length: video.durationInSec * 1000,
              author: spotifyData.artists.map(a => a.name).join(', '),
              identifier: video.id,
              artworkUrl: video.thumbnails[0]?.url
            }
          }];
        }
      } else if (spotifyData.type === 'playlist' || spotifyData.type === 'album') {
        const spotifyTracks = await spotifyData.all_tracks();
        playlistName = spotifyData.name;
        const tracksToResolve = spotifyTracks.slice(0, 25);
        for (const t of tracksToResolve) {
          const searchResult = await play.search(`${t.name} ${t.artists[0]?.name}`, { limit: 1 });
          if (searchResult.length > 0) {
            const video = searchResult[0];
            tracks.push({
              info: {
                title: t.name,
                uri: video.url,
                length: video.durationInSec * 1000,
                author: t.artists.map(a => a.name).join(', '),
                identifier: video.id,
                artworkUrl: video.thumbnails[0]?.url
              }
            });
          }
        }
      }
    } else {
      const searchResult = await play.search(query, { limit: 1 });
      if (searchResult.length > 0) {
        const video = searchResult[0];
        tracks = [{
          info: {
            title: video.title,
            uri: video.url,
            length: video.durationInSec * 1000,
            author: video.channel?.name || 'Unknown Author',
            identifier: video.id,
            artworkUrl: video.thumbnails[0]?.url
          }
        }];
      }
    }
  } else {
    const searchResult = await play.search(query, { limit: 1 });
    if (searchResult.length > 0) {
      const video = searchResult[0];
      tracks = [{
        info: {
          title: video.title,
          uri: video.url,
          length: video.durationInSec * 1000,
          author: video.channel?.name || 'Unknown Author',
          identifier: video.id,
          artworkUrl: video.thumbnails[0]?.url
        }
      }];
    }
  }

  return { tracks, playlistName };
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

  try {
    const { tracks, playlistName } = await resolveTracks(query);

    if (tracks.length === 0) {
      return interaction.editReply('❌ No matches found for your query.');
    }

    // Populate metadata
    tracks.forEach(t => {
      t.requestedBy = member.user;
      t.textChannel = interaction.channel;
    });

    let queue = queues.get(guild.id);
    const isNewQueue = !queue;

    if (!queue) {
      const connection = joinVoiceChannel({
        guildId: guild.id,
        channelId: voiceChannel.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      queue = {
        connection,
        player,
        textChannel: interaction.channel,
        songs: [],
        voters: new Set()
      };

      queues.set(guild.id, queue);

      // Hook player events
      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playNext(guild.id, interaction.client);
      });

      player.on('error', (err) => {
        console.error('[Direct Player Error]:', err);
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        queues.delete(guild.id);
      });
    }

    if (queue.inactivityTimeout) {
      clearTimeout(queue.inactivityTimeout);
      queue.inactivityTimeout = null;
    }

    queue.songs.push(...tracks);

    if (playlistName) {
      if (isNewQueue || queue.songs.length === tracks.length) {
        playNext(guild.id, interaction.client);
        return interaction.editReply(`🎶 Playlist loaded: **${playlistName}** - playing **${tracks[0].info.title}** and queued **${tracks.length}** songs.`);
      } else {
        let totalMs = 0;
        for (let i = 1; i < queue.songs.length - tracks.length; i++) {
          totalMs += queue.songs[i].info.length;
        }

        const embed = new EmbedBuilder()
          .setColor('#1db954')
          .setTitle('🟢 Added Playlist')
          .setDescription(`**Playlist:** **${playlistName}**\nAdded **${tracks.length}** tracks to the queue.`)
          .addFields(
            { name: 'Estimated time until played', value: `\`${formatDuration(totalMs)}\``, inline: true },
            { name: 'Total Tracks Added', value: `\`${tracks.length}\``, inline: true },
            { name: 'Queue Position', value: `\`${queue.songs.length - tracks.length}\` to \`${queue.songs.length - 1}\``, inline: true }
          )
          .setFooter({ text: `Requested by ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    } else {
      const track = tracks[0];
      if (queue.songs.length === 1) {
        playNext(guild.id, interaction.client);
        return interaction.editReply(`🎶 Searching and playing: **${track.info.title}**`);
      } else {
        let totalMs = 0;
        for (let i = 1; i < queue.songs.length - 1; i++) {
          totalMs += queue.songs[i].info.length;
        }

        const embed = new EmbedBuilder()
          .setColor('#1db954')
          .setTitle('🟢 Added Track')
          .setDescription(`**Track**\n[${track.info.title}](${track.info.uri}) by ${track.info.author}`)
          .addFields(
            { name: 'Estimated time until played', value: `\`${formatDuration(totalMs)}\``, inline: true },
            { name: 'Track Length', value: `\`${formatDuration(track.info.length)}\``, inline: true },
            { name: 'Position in upcoming', value: queue.songs.length === 2 ? 'Next' : `\`${queue.songs.length - 1}\``, inline: true },
            { name: 'Position in queue', value: `\`${queue.songs.length - 1}\``, inline: true }
          )
          .setThumbnail(track.info.artworkUrl)
          .setFooter({ text: `Requested by ${track.requestedBy.tag}`, iconURL: track.requestedBy.displayAvatarURL() })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('[Music Execute Error]:', err);
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

  try {
    const { tracks, playlistName } = await resolveTracks(query);

    if (tracks.length === 0) {
      return message.reply('❌ No matches found for your query.');
    }

    // Populate metadata
    tracks.forEach(t => {
      t.requestedBy = member.user;
      t.textChannel = message.channel;
    });

    let queue = queues.get(guild.id);
    const isNewQueue = !queue;

    if (!queue) {
      const connection = joinVoiceChannel({
        guildId: guild.id,
        channelId: voiceChannel.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      queue = {
        connection,
        player,
        textChannel: message.channel,
        songs: [],
        voters: new Set()
      };

      queues.set(guild.id, queue);

      // Hook player events
      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playNext(guild.id, message.client);
      });

      player.on('error', (err) => {
        console.error('[Direct Player Error]:', err);
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        queues.delete(guild.id);
      });
    }

    if (queue.inactivityTimeout) {
      clearTimeout(queue.inactivityTimeout);
      queue.inactivityTimeout = null;
    }

    queue.songs.push(...tracks);

    if (playlistName) {
      if (isNewQueue || queue.songs.length === tracks.length) {
        playNext(guild.id, message.client);
        return message.reply(`🎶 Playlist loaded: **${playlistName}** - playing **${tracks[0].info.title}** and queued **${tracks.length}** songs.`);
      } else {
        let totalMs = 0;
        for (let i = 1; i < queue.songs.length - tracks.length; i++) {
          totalMs += queue.songs[i].info.length;
        }

        const embed = new EmbedBuilder()
          .setColor('#1db954')
          .setTitle('🟢 Added Playlist')
          .setDescription(`**Playlist:** **${playlistName}**\nAdded **${tracks.length}** tracks to the queue.`)
          .addFields(
            { name: 'Estimated time until played', value: `\`${formatDuration(totalMs)}\``, inline: true },
            { name: 'Total Tracks Added', value: `\`${tracks.length}\``, inline: true },
            { name: 'Queue Position', value: `\`${queue.songs.length - tracks.length}\` to \`${queue.songs.length - 1}\``, inline: true }
          )
          .setFooter({ text: `Requested by ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }
    } else {
      const track = tracks[0];
      if (queue.songs.length === 1) {
        playNext(guild.id, message.client);
        return message.reply(`🎶 Searching and playing: **${track.info.title}**`);
      } else {
        let totalMs = 0;
        for (let i = 1; i < queue.songs.length - 1; i++) {
          totalMs += queue.songs[i].info.length;
        }

        const embed = new EmbedBuilder()
          .setColor('#1db954')
          .setTitle('🟢 Added Track')
          .setDescription(`**Track**\n[${track.info.title}](${track.info.uri}) by ${track.info.author}`)
          .addFields(
            { name: 'Estimated time until played', value: `\`${formatDuration(totalMs)}\``, inline: true },
            { name: 'Track Length', value: `\`${formatDuration(track.info.length)}\``, inline: true },
            { name: 'Position in upcoming', value: queue.songs.length === 2 ? 'Next' : `\`${queue.songs.length - 1}\``, inline: true },
            { name: 'Position in queue', value: `\`${queue.songs.length - 1}\``, inline: true }
          )
          .setThumbnail(track.info.artworkUrl)
          .setFooter({ text: `Requested by ${track.requestedBy.tag}`, iconURL: track.requestedBy.displayAvatarURL() })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('[Music Prefix Error]:', err);
    return message.reply('⚠️ Failed to resolve or play the track.');
  }
}
