import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDailyWeeklyLeaderboard } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('yapperdaily')
  .setDescription('View the Top 5 daily yappers and current Yapper of the Day');

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;

  try {
    const leaderboard = await getDailyWeeklyLeaderboard(guild.id, 'daily', 5);
    
    // Find who currently holds the role
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'yapper of the day');
    let currentHolder = 'None';
    if (role) {
      const holderMember = role.members.first();
      if (holderMember) {
        currentHolder = `${holderMember.user.toString()} (\`${holderMember.user.username}\`)`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#f97316')
      .setTitle('☀️ Daily Yapping Leaderboard')
      .setDescription(`Current **Yapper of the Day** role holder: ${currentHolder}\n\nTop active yappers today:`)
      .setTimestamp();

    if (leaderboard.length === 0 || leaderboard.every(u => u.daily_count === 0)) {
      embed.addFields({ name: 'Leaderboard Empty', value: 'Nobody has yapped today yet!' });
    } else {
      leaderboard.forEach((user, index) => {
        if (user.daily_count > 0) {
          embed.addFields({
            name: `#${index + 1} — ${user.username}`,
            value: `**Messages:** \`${user.daily_count}\``
          });
        }
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[YapperDaily] Error:', err.message);
    await interaction.editReply('⚠️ Failed to fetch daily yapping leaderboard.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;

  try {
    const leaderboard = await getDailyWeeklyLeaderboard(guild.id, 'daily', 5);
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'yapper of the day');
    let currentHolder = 'None';
    if (role) {
      const holderMember = role.members.first();
      if (holderMember) {
        currentHolder = `${holderMember.user.toString()} (\`${holderMember.user.username}\`)`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#f97316')
      .setTitle('☀️ Daily Yapping Leaderboard')
      .setDescription(`Current **Yapper of the Day** role holder: ${currentHolder}\n\nTop active yappers today:`)
      .setTimestamp();

    if (leaderboard.length === 0 || leaderboard.every(u => u.daily_count === 0)) {
      embed.addFields({ name: 'Leaderboard Empty', value: 'Nobody has yapped today yet!' });
    } else {
      leaderboard.forEach((user, index) => {
        if (user.daily_count > 0) {
          embed.addFields({
            name: `#${index + 1} — ${user.username}`,
            value: `**Messages:** \`${user.daily_count}\``
          });
        }
      });
    }

    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[YapperDaily Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to fetch daily yapping leaderboard.');
  }
}
