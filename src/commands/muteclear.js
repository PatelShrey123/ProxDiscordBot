import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { clearUserMutes } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('muteclear')
  .setDescription("Clear all mutes for a member to reset their auto-ban count")
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member whose mutes to clear')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only administrators or users with Moderate Members/Manage Guild
  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply('❌ You do not have permission to clear mute counts.');
  }

  try {
    const success = await clearUserMutes(guild.id, targetUser.id);
    if (!success) throw new Error('Database delete operation failed');

    const embed = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle('🔊 Mute Count Cleared')
      .setDescription(`Successfully reset the mute history and count for **${targetUser.tag}** to **0**.`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[MuteClear Execute] Error:', err.message);
    return interaction.editReply('⚠️ Failed to clear user mutes in the database.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply('❌ You do not have permission to clear mute counts.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user whose mutes you want to clear: `.muteclear @user`');
  }

  try {
    const success = await clearUserMutes(guild.id, targetUser.id);
    if (!success) throw new Error('Database error');
    return message.reply(`✅ Successfully cleared all mutes for **${targetUser.username}**. Their mute count has been reset to **0**.`);
  } catch (err) {
    console.error('[MuteClear Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to clear mute count.');
  }
}
