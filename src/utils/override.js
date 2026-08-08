import { Message, TextChannel, DMChannel, User, RepliableInteraction, EmbedBuilder } from 'discord.js';
import { toTypewriter, convertEmbed } from './fontHelper.js';

// Format text/embeds to typewriter
function formatOptions(options) {
  if (!options) return options;

  if (typeof options === 'string') {
    return toTypewriter(options);
  }

  // Handle options object
  if (typeof options === 'object') {
    // Clone options object to prevent side-effects on original properties
    const cloned = { ...options };

    if (cloned.content && typeof cloned.content === 'string') {
      cloned.content = toTypewriter(cloned.content);
    }

    if (cloned.embeds && Array.isArray(cloned.embeds)) {
      cloned.embeds = cloned.embeds.map(embed => {
        if (embed instanceof EmbedBuilder) {
          return convertEmbed(embed);
        }
        if (typeof embed === 'object') {
          try {
            return convertEmbed(EmbedBuilder.from(embed));
          } catch (e) {
            return embed;
          }
        }
        return embed;
      });
    }

    return cloned;
  }

  return options;
}

// 1. Override Message reply
const originalMessageReply = Message.prototype.reply;
Message.prototype.reply = function(options, ...args) {
  return originalMessageReply.call(this, formatOptions(options), ...args);
};

// 2. Override TextChannel send
const originalTextChannelSend = TextChannel.prototype.send;
TextChannel.prototype.send = function(options, ...args) {
  return originalTextChannelSend.call(this, formatOptions(options), ...args);
};

// 3. Override DMChannel send
const originalDMChannelSend = DMChannel.prototype.send;
DMChannel.prototype.send = function(options, ...args) {
  return originalDMChannelSend.call(this, formatOptions(options), ...args);
};

// 4. Override User send
const originalUserSend = User.prototype.send;
User.prototype.send = function(options, ...args) {
  return originalUserSend.call(this, formatOptions(options), ...args);
};

// 5. Override Interaction reply, editReply, followUp
const originalInteractionReply = RepliableInteraction.prototype.reply;
RepliableInteraction.prototype.reply = function(options, ...args) {
  return originalInteractionReply.call(this, formatOptions(options), ...args);
};

const originalInteractionEditReply = RepliableInteraction.prototype.editReply;
RepliableInteraction.prototype.editReply = function(options, ...args) {
  return originalInteractionEditReply.call(this, formatOptions(options), ...args);
};

const originalInteractionFollowUp = RepliableInteraction.prototype.followUp;
RepliableInteraction.prototype.followUp = function(options, ...args) {
  return originalInteractionFollowUp.call(this, formatOptions(options), ...args);
};

console.log('🛡️ [Overrides] Monospace typewriter font applied globally to all bot outputs.');
