import pkg from 'discord.js';
const { Message, TextChannel, DMChannel, User, CommandInteraction, MessageComponentInteraction, ModalSubmitInteraction } = pkg;
import { toTypewriter, convertEmbedToJSON } from './fontHelper.js';

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
      cloned.embeds = cloned.embeds.map(embed => convertEmbedToJSON(embed));
    }

    return cloned;
  }

  return options;
}

// Helper to apply prototype overrides for replies
function applyInteractionOverrides(proto) {
  if (!proto) return;
  
  if (proto.reply) {
    const originalReply = proto.reply;
    proto.reply = function(options, ...args) {
      return originalReply.call(this, formatOptions(options), ...args);
    };
  }
  
  if (proto.editReply) {
    const originalEditReply = proto.editReply;
    proto.editReply = function(options, ...args) {
      return originalEditReply.call(this, formatOptions(options), ...args);
    };
  }
  
  if (proto.followUp) {
    const originalFollowUp = proto.followUp;
    proto.followUp = function(options, ...args) {
      return originalFollowUp.call(this, formatOptions(options), ...args);
    };
  }
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

// 5. Override Interaction classes reply, editReply, followUp
applyInteractionOverrides(CommandInteraction.prototype);
applyInteractionOverrides(MessageComponentInteraction.prototype);
applyInteractionOverrides(ModalSubmitInteraction.prototype);

console.log('🛡️ [Overrides] Monospace typewriter font applied globally to all bot outputs.');
