import { EmbedBuilder } from 'discord.js';
import { updateYapXp, getLevelRewardsStatus } from '../api/db.js';

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

      // Milestone level rewards assignment (multiples of 5: 5, 10, 15, 20...)
      if (result.newLevel % 5 === 0) {
        const isRewardsEnabled = await getLevelRewardsStatus(guildId);
        if (isRewardsEnabled) {
          const roleName = `Level ${result.newLevel}`;
          let milestoneRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
          
          if (!milestoneRole) {
            const colorPalette = [
              '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', 
              '#2ecc71', '#1abc9c', '#e74c3c', '#fd79a8', '#00cec9', 
              '#ffeaa7', '#a29bfe', '#38bdf8', '#a855f7', '#fb923c'
            ];
            
            const usedColors = message.guild.roles.cache.map(r => r.hexColor.toLowerCase());
            let chosenColor = colorPalette.find(c => !usedColors.includes(c.toLowerCase()));
            
            if (!chosenColor) {
              chosenColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            }

            milestoneRole = await message.guild.roles.create({
              name: roleName,
              color: chosenColor,
              reason: `Level milestone reward for reaching Level ${result.newLevel}`
            }).catch(() => null);
          }

          if (milestoneRole) {
            const member = await message.guild.members.fetch(userId).catch(() => null);
            if (member) {
              await member.roles.add(milestoneRole).catch(() => null);

              // Remove previous Level roles (e.g. Level 5, Level 10...)
              for (const [id, role] of member.roles.cache) {
                if (role.name.toLowerCase().startsWith('level ') && role.name.toLowerCase() !== roleName.toLowerCase()) {
                  await member.roles.remove(role, 'Replaced by newer level milestone role').catch(() => null);
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[LevelManager] Failed to award yapping XP:`, err.message);
  }
}
