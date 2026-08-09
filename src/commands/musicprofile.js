import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getMusicStats } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('musicprofile')
  .setDescription("View a user's music listening profile as a beautiful image card")
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

function drawMusicNote(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'; // very subtle
  
  // Note 1 head
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 10, -Math.PI / 6, 0, 2 * Math.PI);
  ctx.fill();
  
  // Note 1 stem
  ctx.fillRect(10, -40, 4, 40);
  
  // Note 2 head
  ctx.beginPath();
  ctx.ellipse(40, -10, 15, 10, -Math.PI / 6, 0, 2 * Math.PI);
  ctx.fill();
  
  // Note 2 stem
  ctx.fillRect(50, -50, 4, 40);
  
  // Beam
  ctx.beginPath();
  ctx.moveTo(10, -40);
  ctx.lineTo(54, -50);
  ctx.lineTo(54, -42);
  ctx.lineTo(10, -32);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

async function generateProfileImage(targetUser, stats, client) {
  const width = 900;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Background (Gradient)
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#3a1315'); // dark red-brown
  grad.addColorStop(1, '#170809'); // very dark brown
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw subtle background elements (musical waves/notes)
  drawMusicNote(ctx, 700, 100, 1.6);
  drawMusicNote(ctx, 150, 480, 0.8);
  drawMusicNote(ctx, 500, 45, 0.6);

  // Draw some subtle wave lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.bezierCurveTo(300, 150, 600, 350, 900, 250);
  ctx.stroke();

  // 3. Draw Header Section
  // Load & draw Avatar
  const avatarSize = 100;
  const avatarX = 50;
  const avatarY = 40;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  try {
    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarUrl);
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } catch (err) {
    // Fallback: draw circle with user initial
    ctx.fillStyle = '#a3333d';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(targetUser.username[0].toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // Draw Avatar Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Username & Stats Summary
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(targetUser.username, avatarX + avatarSize + 25, avatarY + 15);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '18px Arial';
  const formattedTotal = formatPlayTime(stats.total_play_time || 0);
  ctx.fillText(`🎙️ Total listening time: ${formattedTotal}`, avatarX + avatarSize + 25, avatarY + 65);

  // Draw Bot Name on Top Right
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('PROX MUSIC', width - 50, avatarY + 20);

  // 4. Cards Helper function
  function drawCard(x, y, cardW, cardH, title, items, maxLen = 22) {
    // Card background
    ctx.fillStyle = 'rgba(43, 19, 21, 0.5)'; // translucent card
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 8);
    ctx.fill();

    // Card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Card title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + 20, y + 20);

    // Draw Items
    let offsetY = y + 55;
    for (let i = 0; i < 3; i++) {
      const item = items[i];
      
      // Draw Rank Badge (Red Square)
      ctx.fillStyle = '#a3333d';
      ctx.beginPath();
      ctx.roundRect(x + 20, offsetY, 22, 22, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, x + 31, offsetY + 11);

      // Draw Item Text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      if (item) {
        // Highlight duration
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Arial';
        const durText = formatPlayTime(item.duration);
        ctx.fillText(durText, x + 55, offsetY + 11);

        // Draw separator dot and name
        const durWidth = ctx.measureText(durText).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '15px Arial';
        
        // Truncate name if it's too long
        const cleanName = item.name.length > maxLen ? item.name.slice(0, maxLen - 3) + '...' : item.name;
        ctx.fillText(` ·  ${cleanName}`, x + 55 + durWidth + 5, offsetY + 11);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.font = 'italic 14px Arial';
        ctx.fillText('-', x + 55, offsetY + 11);
      }

      offsetY += 38;
    }
  }

  // 5. Populate stats arrays
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

  // 6. Draw Cards
  drawCard(50, 180, 380, 180, 'TOP SERVERS', serversItems, 22);
  drawCard(470, 180, 380, 180, 'TOP FRIENDS', friendsItems, 22);
  drawCard(50, 390, 800, 170, 'TOP TRACKS', tracksItems, 55);

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
