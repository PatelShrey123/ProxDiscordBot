import { getMusicStats, saveMusicStats } from '../api/db.js';

export async function recordTrackPlay(guildId, song, client) {
  if (!song || !song.startedAt) return;

  const elapsed = Math.floor((Date.now() - song.startedAt) / 1000); // duration in seconds
  delete song.startedAt; // clear to avoid double counting

  if (elapsed < 5) return; // ignore short plays (less than 5 seconds)

  // Find the guild and the voice channel the bot is in
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const botMember = guild.members.me;
  const voiceChannel = botMember?.voice.channel;
  if (!voiceChannel) return;

  // Get all non-bot members currently in the voice channel
  const members = voiceChannel.members.filter(m => !m.user.bot);
  if (members.size === 0) return;

  console.log(`[MusicStats] Recording ${elapsed}s for ${members.size} members in guild ${guild.name} ("${song.info.title}")`);

  // Update stats for each member in the voice channel
  for (const [memberId, member] of members) {
    try {
      const userId = member.user.id;
      
      // Get existing stats or initialize default
      const stats = await getMusicStats(userId) || {
        total_play_time: 0,
        top_tracks: [],
        top_servers: {},
        top_friends: {}
      };

      // Ensure properties exist
      stats.total_play_time = parseInt(stats.total_play_time || 0) + elapsed;
      stats.top_servers = stats.top_servers || {};
      stats.top_friends = stats.top_friends || {};
      stats.top_tracks = Array.isArray(stats.top_tracks) ? stats.top_tracks : [];

      // Update server time
      stats.top_servers[guildId] = (stats.top_servers[guildId] || 0) + elapsed;

      // Update track plays
      let track = stats.top_tracks.find(t => t.title === song.info.title);
      if (track) {
        track.play_count = (track.play_count || 0) + 1;
        track.duration = (track.duration || 0) + elapsed;
      } else {
        stats.top_tracks.push({
          title: song.info.title,
          author: song.info.author || 'Unknown',
          play_count: 1,
          duration: elapsed
        });
      }

      // Sort and keep top 10 tracks to save space
      stats.top_tracks = stats.top_tracks
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);

      // Update friends co-presence time
      for (const [otherId, otherMember] of members) {
        if (otherId !== userId) {
          stats.top_friends[otherId] = (stats.top_friends[otherId] || 0) + elapsed;
        }
      }

      // Keep top 10 friends to save space
      const sortedFriends = Object.entries(stats.top_friends)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      stats.top_friends = Object.fromEntries(sortedFriends);

      // Keep top 10 servers to save space
      const sortedServers = Object.entries(stats.top_servers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      stats.top_servers = Object.fromEntries(sortedServers);

      // Save back to DB
      await saveMusicStats(userId, stats);
    } catch (err) {
      console.error(`[MusicStats] Failed to save stats for user ${member.user.tag}:`, err.message);
    }
  }
}
