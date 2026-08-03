import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getYapLevel, getYapLeaderboard } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Check leveling rank status and top yappers')
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand.setName('rank')
      .setDescription('View your current yapping level rank card')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The member to view')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('leaderboard')
      .setDescription('View the Top 10 yappers in this server')
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (subcommand === 'rank') {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const stats = await getYapLevel(guild.id, targetUser.id, targetUser.username);

    const threshold = 5 * (stats.level * stats.level) + 50 * stats.level + 100;
    const progressPct = Math.min(100, Math.round((stats.xp / threshold) * 100));

    const embed = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle(`📊 Rank Card: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Level', value: `\`${stats.level}\``, inline: true },
        { name: 'Yaps Count', value: `\`${(stats.message_count || 0).toLocaleString()}\``, inline: true },
        { name: 'XP Progress', value: `\`${(stats.xp || 0).toLocaleString()} / ${threshold.toLocaleString()} (${progressPct}%)\``, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else if (subcommand === 'leaderboard') {
    const board = await getYapLeaderboard(guild.id);

    const list = board.map((row, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `${medal} **${row.username}** — Level ${row.level} (${Number(row.xp || 0).toLocaleString()} XP, ${Number(row.message_count || 0).toLocaleString()} Yaps)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#fbbf24')
      .setTitle('🗣️ Top 10 Yappers Leaderboard')
      .setDescription(list || 'No leveling logs found in this server yet.')
      .setFooter({ text: 'Keep chatting to climb the leaderboard!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export async function executePrefix(message, args, overrideCmd = null) {
  const guild = message.guild;
  const cmd = overrideCmd || args[0]?.toLowerCase();

  if (cmd === 'rank' || message.content.toLowerCase().startsWith('.rank')) {
    const targetUser = message.mentions.users.first() || message.author;
    const stats = await getYapLevel(guild.id, targetUser.id, targetUser.username);

    const threshold = 5 * (stats.level * stats.level) + 50 * stats.level + 100;
    const progressPct = Math.min(100, Math.round((stats.xp / threshold) * 100));

    const embed = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle(`📊 Rank Card: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Level', value: `\`${stats.level}\``, inline: true },
        { name: 'Yaps Count', value: `\`${(stats.message_count || 0).toLocaleString()}\``, inline: true },
        { name: 'XP Progress', value: `\`${(stats.xp || 0).toLocaleString()} / ${threshold.toLocaleString()} (${progressPct}%)\``, inline: false }
      );
    return message.reply({ embeds: [embed] });
  } else if (cmd === 'leaderboard' || message.content.toLowerCase().startsWith('.leaderboard') || message.content.toLowerCase().startsWith('.yappers')) {
    const board = await getYapLeaderboard(guild.id);

    const list = board.map((row, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `${medal} **${row.username}** — Level ${row.level} (${Number(row.xp || 0).toLocaleString()} XP, ${Number(row.message_count || 0).toLocaleString()} Yaps)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#fbbf24')
      .setTitle('🗣️ Top 10 Yappers Leaderboard')
      .setDescription(list || 'No leveling logs found in this server yet.');
    return message.reply({ embeds: [embed] });
  }
}
