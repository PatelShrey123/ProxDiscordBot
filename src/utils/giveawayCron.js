import { EmbedBuilder } from 'discord.js';
import { getActiveGiveaways, updateGiveawayWinners } from '../api/db.js';

export function startGiveawayCron(client) {
  // Check for ended giveaways every 15 seconds
  setInterval(async () => {
    try {
      const activeEnded = await getActiveGiveaways();
      for (const gw of activeEnded) {
        await processGiveawayEnd(client, gw);
      }
    } catch (err) {
      console.error('[GiveawayCron] Error in daemon check:', err.message);
    }
  }, 15000);
}

export async function processGiveawayEnd(client, gw) {
  const { guild_id, channel_id, message_id, prize, winner_count } = gw;

  try {
    const guild = await client.guilds.fetch(guild_id).catch(() => null);
    if (!guild) {
      // Guild no longer accessible, end in DB
      await updateGiveawayWinners(message_id, []);
      return;
    }

    const channel = await guild.channels.fetch(channel_id).catch(() => null);
    if (!channel) {
      // Channel deleted, end in DB
      await updateGiveawayWinners(message_id, []);
      return;
    }

    const msg = await channel.messages.fetch(message_id).catch(() => null);
    if (!msg) {
      // Message deleted, end in DB
      await updateGiveawayWinners(message_id, []);
      return;
    }

    // Draw winners from the giveaway reaction
    const reaction = msg.reactions.cache.get('🎉');
    let participants = [];

    if (reaction) {
      const users = await reaction.users.fetch();
      participants = Array.from(users.values())
        .filter(u => !u.bot)
        .map(u => u.id);
    }

    const winners = [];
    const countToDraw = Math.min(winner_count, participants.length);

    for (let i = 0; i < countToDraw; i++) {
      const idx = Math.floor(Math.random() * participants.length);
      winners.push(participants.splice(idx, 1)[0]);
    }

    // Save winners in DB and mark ended
    await updateGiveawayWinners(message_id, winners);

    const winnerMentions = winners.map(w => `<@${w}>`).join(', ');

    // Edit message with ended state
    const endedEmbed = new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY ENDED 🎉')
      .setColor('#ef4444')
      .setDescription(`**Prize:** ${prize}\n**Ended:** <t:${Math.floor(Date.now() / 1000)}:R>`)
      .addFields(
        { 
          name: 'Winners', 
          value: winners.length > 0 ? winnerMentions : 'No participants joined the giveaway.' 
        }
      )
      .setFooter({ text: 'Giveaway Ended' })
      .setTimestamp();

    await msg.edit({
      embeds: [endedEmbed],
      components: []
    });

    if (winners.length > 0) {
      await channel.send(`🎉 Congratulations ${winnerMentions}! You won the giveaway for **${prize}**!`);
    } else {
      await channel.send(`⚠️ No one reacted with 🎉 to win the giveaway for **${prize}**.`);
    }

  } catch (err) {
    console.error(`[GiveawayCron] Failed to end giveaway ${message_id}:`, err.message);
    // Mark ended to prevent infinite retry loops on crash
    await updateGiveawayWinners(message_id, []).catch(() => {});
  }
}
