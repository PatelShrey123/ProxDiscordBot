import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getMuteSettings, getUserMuteCount } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('mutes')
  .setDescription("Check a member's current mute count and limit threshold")
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to check (defaults to you)')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target') || interaction.user;
  const guild = interaction.guild;

  try {
    const { mute_threshold } = await getMuteSettings(guild.id);
    const muteCount = await getUserMuteCount(guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle(`🔇 Mute Count: ${targetUser.username}`)
      .setDescription(`Current mute count status for ${targetUser}.`)
      .addFields(
        { name: 'Mute Status', value: `\`${muteCount}/${mute_threshold}\` mutes`, inline: true },
        { name: 'Mutes Remaining', value: `\`${Math.max(0, mute_threshold - muteCount)}\` before automatic ban`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Mutes Execute] Error:', err.message);
    return interaction.editReply('⚠️ Failed to fetch mute count details from the database.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  let targetUser = message.author;

  if (args.length > 0) {
    targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
    if (!targetUser) {
      return message.reply('❌ Could not find that user.');
    }
  }

  try {
    const { mute_threshold } = await getMuteSettings(guild.id);
    const muteCount = await getUserMuteCount(guild.id, targetUser.id);

    return message.reply(`ℹ️ **${targetUser.username}** has **${muteCount}/${mute_threshold}** mutes. (\`${Math.max(0, mute_threshold - muteCount)}\` mutes left before automatic ban).`);
  } catch (err) {
    console.error('[Mutes Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to fetch mute count details.');
  }
}
