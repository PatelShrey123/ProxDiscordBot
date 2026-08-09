import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getMusicStats } from '../api/db.js';
import path from 'path';

export const data = new SlashCommandBuilder()
  .setName('musicprofile')
  .setDescription("View a user's music listening profile as a beautiful, high-quality image card")
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

async function generateProfileImage(targetUser, stats, client) {
  // Use 2x resolution (1800x1200) for ultra-sharp text and graphic rendering
  const width = 1800;
  const height = 1200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Draw Background Image
  try {
    const bgPath = path.resolve('./src/background.png');
    const bgImg = await loadImage(bgPath);
    ctx.drawImage(bgImg, 0, 0, width, height);
  } catch (err) {
    console.error('[MusicProfile Image Loading Error]:', err.message);
    // Fallback gradient if background image fails to load
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#fbf8f5');
    grad.addColorStop(1, '#e3e5e8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Draw Header Section
  // Load & draw Avatar
  const avatarSize = 200;
  const avatarX = 100;
  const avatarY = 80;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  try {
    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 512 });
    const avatarImg = await loadImage(avatarUrl);
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } catch (err) {
    // Fallback: draw circle with user initial
    ctx.fillStyle = '#a3333d';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 100px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(targetUser.username[0].toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // Draw Avatar Border
  ctx.strokeStyle = 'rgba(43, 19, 21, 0.15)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Username (Dark text for readability on light watercolor background)
  ctx.fillStyle = '#2b1315';
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(targetUser.username, avatarX + avatarSize + 50, avatarY + 30);

  // Draw Stats Summary
  ctx.fillStyle = 'rgba(43, 19, 21, 0.8)';
  ctx.font = '32px Arial';
  const formattedTotal = formatPlayTime(stats.total_play_time || 0);
  ctx.fillText(`🎙️ Total listening time: ${formattedTotal}`, avatarX + avatarSize + 50, avatarY + 120);

  // Draw Bot Name on Top Right
  ctx.fillStyle = 'rgba(43, 19, 21, 0.6)';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('PROX MUSIC', width - 100, avatarY + 40);

  // 3. Cards Helper function
  function drawCard(x, y, cardW, cardH, title, items, maxLen = 22) {
    // Dark semi-transparent card background for crisp text contrast
    ctx.fillStyle = 'rgba(43, 19, 21, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 16);
    ctx.fill();

    // Card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Card title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + 40, y + 40);

    // Draw Items
    let offsetY = y + 100;
    for (let i = 0; i < 3; i++) {
      const item = items[i];
      
      // Draw Rank Badge (Red Square)
      ctx.fillStyle = '#a3333d';
      ctx.beginPath();
      ctx.roundRect(x + 40, offsetY, 44, 44, 8);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, x + 62, offsetY + 22);

      // Draw Item Text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      if (item) {
        // Highlight duration in bold white text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Arial';
        const durText = formatPlayTime(item.duration);
        ctx.fillText(durText, x + 110, offsetY + 22);

        // Draw separator dot and name
        const durWidth = ctx.measureText(durText).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '30px Arial';
        
        // Truncate name if it's too long
        const cleanName = item.name.length > maxLen ? item.name.slice(0, maxLen - 3) + '...' : item.name;
        ctx.fillText(` ·  ${cleanName}`, x + 110 + durWidth + 10, offsetY + 22);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = 'italic 28px Arial';
        ctx.fillText('-', x + 110, offsetY + 22);
      }

      offsetY += 76;
    }
  }

  // 4. Populate stats arrays
  // Top Servers
  const serversItems = [];
  const topServers = Object.entries(stats.top_servers || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [serverId, duration] of topServers) {
    const guild = client.guilds.cache.get(serverId);
    serversItems.push({
      duration,
      name: guild ? guild.name : `Server (${serverId})`
    });
  }

  // Top Friends
  const friendsItems = [];
  const topFriends = Object.entries(stats.top_friends || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [friendId, duration] of topFriends) {
    let friendUser = client.users.cache.get(friendId);
    if (!friendUser) {
      friendUser = await client.users.fetch(friendId).catch(() => null);
    }
    friendsItems.push({
      duration,
      name: friendUser ? friendUser.username : `User (${friendId})`
    });
  }

  // Top Tracks
  const tracksItems = (stats.top_tracks || []).slice(0, 3).map(t => ({
    duration: t.duration,
    name: t.title
  }));

  // 5. Draw Cards
  drawCard(100, 360, 760, 360, 'TOP SERVERS', serversItems, 22);
  drawCard(940, 360, 760, 360, 'TOP FRIENDS', friendsItems, 22);
  drawCard(100, 780, 1600, 340, 'TOP TRACKS', tracksItems, 60);

  // Return canvas buffer
  return canvas.toBuffer('image/png');
}

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  try {
    const stats = await getMusicStats(targetUser.id);
    if (!stats || (!stats.total_play_time && !stats.top_tracks?.length)) {
      return interaction.editReply(`❌ **${targetUser.username}** doesn't have a music profile yet! Start playing music in voice channels to build your profile.`);
    }

    const imageBuffer = await generateProfileImage(targetUser, stats, interaction.client);
    const attachment = new AttachmentBuilder(imageBuffer, { name: `${targetUser.username}_music_profile.png` });

    await interaction.editReply({ files: [attachment] });
  } catch (err) {
    console.error('[MusicProfile Execute Error]:', err.message);
    await interaction.editReply('⚠️ Failed to load the music profile card.');
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
    const stats = await getMusicStats(targetUser.id);
    if (!stats || (!stats.total_play_time && !stats.top_tracks?.length)) {
      return message.reply(`❌ **${targetUser.username}** doesn't have a music profile yet! Start playing music in voice channels to build your profile.`);
    }

    const imageBuffer = await generateProfileImage(targetUser, stats, message.client);
    const attachment = new AttachmentBuilder(imageBuffer, { name: `${targetUser.username}_music_profile.png` });

    await message.reply({ files: [attachment] });
  } catch (err) {
    console.error('[MusicProfile Prefix Error]:', err.message);
    await message.reply('⚠️ Failed to load the music profile card.');
  }
}
