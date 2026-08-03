import { EmbedBuilder } from 'discord.js';
import { updateYapXp } from '../api/db.js';

// Cooldown map: key = `${guildId}_${userId}`, value = last_xp_awarded_timestamp (ms)
const cooldowns = new Map();
const COOLDOWN_TIME = 60 * 1000; // 60 seconds

export async function handleYapMessage(message) {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const username = message.author.username;
  
  const key = `${guildId}_${userId}`;
  const now = Date.now();

  // Check cooldown
  if (cooldowns.has(key)) {
    const lastAwarded = cooldowns.get(key);
    if (now - lastAwarded < COOLDOWN_TIME) {
      return; // Ignore message for XP since they are yapping too fast!
    }
  }

  // Set new cooldown timestamp
  cooldowns.set(key, now);

  // Generate random XP between 15 and 25
  const xpToAdd = Math.floor(Math.random() * 11) + 15;

  try {
    const result = await updateYapXp(guildId, userId, username, xpToAdd);
    
    if (result && result.didLevelUp) {
      const levelUpEmbed = new EmbedBuilder()
        .setColor('#10b981')
        .setTitle('🎉 Level Up!')
        .setDescription(`Congratulations **${message.author}**! You have yapped your way to **Level ${result.newLevel}**!`)
        .addFields(
          { name: 'Total Messages', value: `\`${(result.data.message_count || 1).toLocaleString()}\``, inline: true },
          { name: 'Total XP', value: `\`${(result.data.xp || 0).toLocaleString()}\``, inline: true }
        )
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      let targetChannel = message.channel;

      if (guildId === '1493633686506049566') {
        const levelUpChannel = await message.guild.channels.fetch('1494017082298470400').catch(() => null);
        if (levelUpChannel) {
          targetChannel = levelUpChannel;
        } else {
          return; // Obey "nowhere else in this server" if channel is missing or inaccessible
        }
      }

      await targetChannel.send({ content: `${message.author}`, embeds: [levelUpEmbed] });
    }
  } catch (err) {
    console.error(`[LevelManager] Failed to award yapping XP:`, err.message);
  }
}
