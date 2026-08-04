import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../api/db.js';

export async function handleStarboardReaction(reaction, user) {
  // Only handle star reactions
  if (reaction.emoji.name !== '⭐') return;

  const message = reaction.message;
  const guild = message.guild;
  if (!guild) return;

  // Resolve partials if necessary
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('[Starboard] Failed to fetch partial reaction:', err.message);
      return;
    }
  }

  if (message.partial) {
    try {
      await message.fetch();
    } catch (err) {
      console.error('[Starboard] Failed to fetch partial message:', err.message);
      return;
    }
  }

  // Get settings
  const settings = await getGuildSettings(guild.id);
  if (!settings || !settings.starboard_enabled || !settings.starboard_channel_id) return;

  // Do not starboard messages in the starboard channel itself
  if (message.channel.id === settings.starboard_channel_id) return;

  const count = reaction.count;
  const threshold = settings.starboard_threshold || 5;

  const starboardChannel = await guild.channels.fetch(settings.starboard_channel_id).catch(() => null);
  if (!starboardChannel || !starboardChannel.isTextBased()) return;

  // Fetch last 100 messages from starboard to check if already posted
  const starboardMessages = await starboardChannel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!starboardMessages) return;

  // Find message with this ID in the footer
  const existingMsg = starboardMessages.find(m => 
    m.embeds[0] && 
    m.embeds[0].footer && 
    m.embeds[0].footer.text.startsWith(message.id)
  );

  if (count >= threshold) {
    const embed = new EmbedBuilder()
      .setColor('#ffac33') // Star gold color
      .setAuthor({ 
        name: message.author.username, 
        iconURL: message.author.displayAvatarURL({ dynamic: true }) 
      })
      .setDescription(message.content || '*No text content*')
      .addFields(
        { name: 'Source', value: `[Jump!](${message.url})` }
      )
      .setFooter({ 
        text: `${message.id} • ${new Date(message.createdTimestamp).toLocaleString()}` 
      });

    // Handle image attachments
    const attachment = message.attachments.first();
    if (attachment && attachment.contentType && attachment.contentType.startsWith('image/')) {
      embed.setImage(attachment.url);
    }

    const contentText = `⭐ **${count}** <#${message.channel.id}>`;

    if (existingMsg) {
      // Edit the existing post
      await existingMsg.edit({ content: contentText, embeds: [embed] }).catch(() => null);
    } else {
      // Create new post
      await starboardChannel.send({ content: contentText, embeds: [embed] }).catch(() => null);
    }
  } else {
    // If count fell below threshold and it exists in starboard, delete it
    if (existingMsg) {
      await existingMsg.delete().catch(() => null);
    }
  }
}
