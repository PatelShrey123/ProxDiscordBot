import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getMusicStats } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('musicprofile')
  .setDescription("View a user's music listening profile")
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose music profile you want to view')
      .setRequired(false)
  );

function formatPlayTime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (hours === 0 && secs > 0) parts.push(`${secs}s`);
  return parts.join(' ') || '0s';
}

function getEmoji(index) {
  if (index === 1) return '1️⃣';
  if (index === 2) return '2️⃣';
  if (index === 3) return '3️⃣';
  return '▪️';
}

async function buildProfileEmbed(targetUser, client) {
  const stats = await getMusicStats(targetUser.id);
  if (!stats || (!stats.total_play_time && !stats.top_tracks?.length)) {
    return null;
  }

  // Format Top Servers
  const serversLines = [];
  const topServers = Object.entries(stats.top_servers || {}).slice(0, 3);
  for (let i = 0; i < topServers.length; i++) {
    const [serverId, duration] = topServers[i];
    const guild = client.guilds.cache.get(serverId);
    const serverName = guild ? guild.name : `Server (${serverId})`;
    serversLines.push(`${getEmoji(i + 1)} **${formatPlayTime(duration)}** · ${serverName}`);
  }

  // Format Top Friends
  const friendsLines = [];
  const topFriends = Object.entries(stats.top_friends || {}).slice(0, 3);
  for (let i = 0; i < topFriends.length; i++) {
    const [friendId, duration] = topFriends[i];
    let friendUser = client.users.cache.get(friendId);
    if (!friendUser) {
      friendUser = await client.users.fetch(friendId).catch(() => null);
    }
    const friendName = friendUser ? friendUser.username : `User (${friendId})`;
    friendsLines.push(`${getEmoji(i + 1)} **${formatPlayTime(duration)}** · ${friendName}`);
  }

  // Format Top Tracks
  const tracksLines = [];
  const topTracks = (stats.top_tracks || []).slice(0, 3);
  for (let i = 0; i < topTracks.length; i++) {
    const track = topTracks[i];
    tracksLines.push(`${getEmoji(i + 1)} **${formatPlayTime(track.duration)}** · ${track.title}`);
  }

  const embed = new EmbedBuilder()
    .setColor('#a3333d')
    .setTitle(`${targetUser.username}'s Music Profile`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setDescription(`🎙️ **Total listening time:** \`${formatPlayTime(stats.total_play_time || 0)}\``)
    .addFields(
      {
        name: '📁 TOP SERVERS',
        value: serversLines.join('\n') || '*No servers recorded yet*',
        inline: true
      },
      {
        name: '👥 TOP FRIENDS',
        value: friendsLines.join('\n') || '*No friends recorded yet*',
        inline: true
      },
      {
        name: '🎵 TOP TRACKS',
        value: tracksLines.join('\n') || '*No tracks recorded yet*',
        inline: false
      }
    )
    .setFooter({ text: 'Jockie Music Vibe • Stats updated dynamically', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  try {
    const embed = await buildProfileEmbed(targetUser, interaction.client);
    if (!embed) {
      return interaction.editReply(`❌ **${targetUser.username}** doesn't have a music profile yet! Start playing music in voice channels to build your profile.`);
    }
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[MusicProfile Execute Error]:', err.message);
    await interaction.editReply('⚠️ Failed to load the music profile.');
  }
}

export async function executePrefix(message, args) {
  let targetUser = message.author;

  if (args.length > 0) {
    const mentioned = message.mentions.users.first();
    if (mentioned) {
      targetUser = mentioned;
    } else {
      const userId = args[0].replace(/[^0-9]/g, '');
      if (userId) {
        try {
          targetUser = await message.client.users.fetch(userId);
        } catch {
          return message.reply('❌ Could not find a user with that ID.');
        }
      }
    }
  }

  try {
    const embed = await buildProfileEmbed(targetUser, message.client);
    if (!embed) {
      return message.reply(`❌ **${targetUser.username}** doesn't have a music profile yet! Start playing music in voice channels to build your profile.`);
    }
    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[MusicProfile Prefix Error]:', err.message);
    await message.reply('⚠️ Failed to load the music profile.');
  }
}
