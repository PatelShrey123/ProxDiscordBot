import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDailyWeeklyLeaderboard } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('yapperweekly')
  .setDescription('View the Top 5 weekly yappers and current Yapper of the Week');

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;

  try {
    const leaderboard = await getDailyWeeklyLeaderboard(guild.id, 'weekly', 5);
    
    // Find who currently holds the role
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'yapper of the week');
    let currentHolder = 'None';
    if (role) {
      const holderMember = role.members.first();
      if (holderMember) {
        currentHolder = `${holderMember.user.toString()} (\`${holderMember.user.username}\`)`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#e11d48')
      .setTitle('🏆 Weekly Yapping Leaderboard')
      .setDescription(`Current **Yapper of the Week** role holder: ${currentHolder}\n\nTop active yappers this week:`)
      .setTimestamp();

    if (leaderboard.length === 0 || leaderboard.every(u => u.weekly_count === 0)) {
      embed.addFields({ name: 'Leaderboard Empty', value: 'Nobody has yapped this week yet!' });
    } else {
      leaderboard.forEach((user, index) => {
        if (user.weekly_count > 0) {
          embed.addFields({
            name: `#${index + 1} — ${user.username}`,
            value: `**Messages:** \`${user.weekly_count}\``
          });
        }
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[YapperWeekly] Error:', err.message);
    await interaction.editReply('⚠️ Failed to fetch weekly yapping leaderboard.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;

  try {
    const leaderboard = await getDailyWeeklyLeaderboard(guild.id, 'weekly', 5);
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'yapper of the week');
    let currentHolder = 'None';
    if (role) {
      const holderMember = role.members.first();
      if (holderMember) {
        currentHolder = `${holderMember.user.toString()} (\`${holderMember.user.username}\`)`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#e11d48')
      .setTitle('🏆 Weekly Yapping Leaderboard')
      .setDescription(`Current **Yapper of the Week** role holder: ${currentHolder}\n\nTop active yappers this week:`)
      .setTimestamp();

    if (leaderboard.length === 0 || leaderboard.every(u => u.weekly_count === 0)) {
      embed.addFields({ name: 'Leaderboard Empty', value: 'Nobody has yapped this week yet!' });
    } else {
      leaderboard.forEach((user, index) => {
        if (user.weekly_count > 0) {
          embed.addFields({
            name: `#${index + 1} — ${user.username}`,
            value: `**Messages:** \`${user.weekly_count}\``
          });
        }
      });
    }

    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[YapperWeekly Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to fetch weekly yapping leaderboard.');
  }
}
