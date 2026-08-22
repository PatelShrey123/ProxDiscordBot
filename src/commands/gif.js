import { SlashCommandBuilder } from 'discord.js';
import ffmpeg from 'ffmpeg-static';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFilePromise = promisify(execFile);

export const data = new SlashCommandBuilder()
  .setName('gif')
  .setDescription('Convert a picture or video to a GIF')
  .addAttachmentOption(option =>
    option
      .setName('file')
      .setDescription('The picture or video to convert')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('url')
      .setDescription('The URL of the picture or video to convert')
      .setRequired(false)
  );

function findUrlInText(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s$.?#].[^\s]*/gi);
  if (match) {
    const url = match[0].split('?')[0];
    if (isSupportedMedia(url)) {
      return match[0]; // return full URL with query params
    }
  }
  return null;
}

function isSupportedMedia(url) {
  return /\.(png|jpg|jpeg|webp|bmp|mp4|mov|webm|avi|mkv|gif|gifv|m4v)(\?|$)/i.test(url);
}

async function getMediaUrl(interactionOrMessage, args = []) {
  // If it's an interaction (Slash command)
  if (interactionOrMessage.options) {
    const file = interactionOrMessage.options.getAttachment('file');
    if (file) return file.url;

    const url = interactionOrMessage.options.getString('url');
    if (url) return url;

    // Check channel history as fallback
    const channel = interactionOrMessage.channel;
    if (channel) {
      try {
        const messages = await channel.messages.fetch({ limit: 15 });
        for (const msg of messages.values()) {
          const attachmentUrl = msg.attachments.first()?.url;
          if (attachmentUrl && isSupportedMedia(attachmentUrl)) return attachmentUrl;
          const textUrl = findUrlInText(msg.content);
          if (textUrl) return textUrl;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  }

  // If it's a prefix command message
  const message = interactionOrMessage;

  // 1. Check attachment on message
  const attachmentUrl = message.attachments.first()?.url;
  if (attachmentUrl) return attachmentUrl;

  // 2. Check first argument as URL
  if (args.length > 0 && args[0].startsWith('http')) {
    if (isSupportedMedia(args[0])) return args[0];
  }

  // 3. Check referenced message (reply)
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
      const refAttachmentUrl = referencedMsg.attachments.first()?.url;
      if (refAttachmentUrl) return refAttachmentUrl;
      const refTextUrl = findUrlInText(referencedMsg.content);
      if (refTextUrl) return refTextUrl;
    } catch (e) {
      console.error(e);
    }
  }

  // 4. Check channel history
  try {
    const messages = await message.channel.messages.fetch({ limit: 15 });
    for (const msg of messages.values()) {
      const msgAttachmentUrl = msg.attachments.first()?.url;
      if (msgAttachmentUrl && isSupportedMedia(msgAttachmentUrl)) return msgAttachmentUrl;
      const msgTextUrl = findUrlInText(msg.content);
      if (msgTextUrl) return msgTextUrl;
    }
  } catch (e) {
    console.error(e);
  }

  return null;
}

export async function execute(interaction) {
  await interaction.deferReply();

  const url = await getMediaUrl(interaction);
  if (!url) {
    return interaction.editReply('❌ No supported media found. Please attach an image/video, provide a URL, or run this in a channel with recent media.');
  }

  // Clean filename extension from query params
  const cleanUrl = url.split('?')[0];
  const ext = path.extname(cleanUrl) || '.mp4';
  const inputPath = path.join(os.tmpdir(), `gif_in_${Date.now()}${ext}`);
  const outputPath = path.join(os.tmpdir(), `gif_out_${Date.now()}.gif`);

  try {
    // Notify status
    await interaction.editReply('⏳ Downloading media...');
    
    // Download media
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(inputPath, buffer);

    await interaction.editReply('⏳ Converting to GIF using FFMPEG...');

    const isVideoOrGif = /\.(mp4|mov|webm|avi|mkv|gifv|m4v|gif)(\?|$)/i.test(url);
    const ffmpegArgs = ['-y', '-i', inputPath];

    if (isVideoOrGif) {
      // Optimize for video/gif conversion
      ffmpegArgs.push(
        '-t', '10', // limit to 10 seconds to save space and time
        '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse',
        '-c:v', 'gif'
      );
    } else {
      // For static images, just convert directly to gif
      ffmpegArgs.push('-pix_fmt', 'rgb24');
    }

    ffmpegArgs.push(outputPath);

    // Run FFMPEG
    await execFilePromise(ffmpeg, ffmpegArgs, { timeout: 30000 });

    // Verify output exists and size
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFMPEG output file not found');
    }

    const stats = fs.statSync(outputPath);
    if (stats.size > 25 * 1024 * 1024) {
      return interaction.editReply('❌ The converted GIF file is too large to upload (> 25MB). Please use a shorter or smaller video.');
    }

    await interaction.editReply('⏳ Uploading GIF to Discord...');

    const reply = await interaction.editReply({
      content: '✅ Conversion successful!',
      files: [{
        attachment: outputPath,
        name: 'converted.gif'
      }]
    });

    // Extract CDN link and post it
    const attachment = reply.attachments?.first();
    if (attachment) {
      await interaction.editReply({
        content: `✅ Conversion successful!\n🔗 **Link:** ${attachment.url}`
      });
    }
  } catch (error) {
    console.error('GIF Command Error:', error);
    await interaction.editReply(`❌ Failed to convert media to GIF: ${error.message}`);
  } finally {
    // Cleanup files
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (e) {
      console.error('Temp file cleanup error:', e);
    }
  }
}

export async function executePrefix(message, args) {
  const statusMsg = await message.reply('⏳ Downloading and converting media...');

  const url = await getMediaUrl(message, args);
  if (!url) {
    return statusMsg.edit('❌ No supported media found. Please attach an image/video, provide a URL, reply to a message containing media, or run this in a channel with recent media.');
  }

  // Clean filename extension from query params
  const cleanUrl = url.split('?')[0];
  const ext = path.extname(cleanUrl) || '.mp4';
  const inputPath = path.join(os.tmpdir(), `gif_in_${Date.now()}${ext}`);
  const outputPath = path.join(os.tmpdir(), `gif_out_${Date.now()}.gif`);

  try {
    // Download media
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(inputPath, buffer);

    await statusMsg.edit('⏳ Converting to GIF using FFMPEG...');

    const isVideoOrGif = /\.(mp4|mov|webm|avi|mkv|gifv|m4v|gif)(\?|$)/i.test(url);
    const ffmpegArgs = ['-y', '-i', inputPath];

    if (isVideoOrGif) {
      // Optimize for video/gif conversion
      ffmpegArgs.push(
        '-t', '10', // limit to 10 seconds to save space and time
        '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse',
        '-c:v', 'gif'
      );
    } else {
      // For static images, just convert directly to gif
      ffmpegArgs.push('-pix_fmt', 'rgb24');
    }

    ffmpegArgs.push(outputPath);

    // Run FFMPEG
    await execFilePromise(ffmpeg, ffmpegArgs, { timeout: 30000 });

    // Verify output exists and size
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFMPEG output file not found');
    }

    const stats = fs.statSync(outputPath);
    if (stats.size > 25 * 1024 * 1024) {
      return statusMsg.edit('❌ The converted GIF file is too large to upload (> 25MB). Please use a shorter or smaller video.');
    }

    await statusMsg.edit('⏳ Uploading GIF to Discord...');

    const reply = await message.reply({
      content: '✅ Conversion successful!',
      files: [{
        attachment: outputPath,
        name: 'converted.gif'
      }]
    });

    // Delete the original status message to keep chat clean
    try {
      await statusMsg.delete();
    } catch (e) {}

    // Extract CDN link and edit the reply to print it
    const attachment = reply.attachments?.first();
    if (attachment) {
      await reply.edit({
        content: `✅ Conversion successful!\n🔗 **Link:** ${attachment.url}`
      });
    }
  } catch (error) {
    console.error('GIF Command Error:', error);
    await statusMsg.edit(`❌ Failed to convert media to GIF: ${error.message}`);
  } finally {
    // Cleanup files
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (e) {
      console.error('Temp file cleanup error:', e);
    }
  }
}
