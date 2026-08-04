import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Unmute a timed out or permanently muted member')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to unmute')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;
  const executor = interaction.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to unmute members.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  try {
    // 1. Remove native Discord timeout
    await targetMember.timeout(null, `Unmuted by ${executor.user.username}`);

    // 2. Remove Muted role if they have it
    const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (muteRole && targetMember.roles.cache.has(muteRole.id)) {
      await targetMember.roles.remove(muteRole.id);
    }

    // 3. Log action
    await addModerationAction(guild.id, targetUser.id, executor.id, 'UNMUTE', 'Unmuted by command');

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle('🔊 Member Unmuted')
      .setDescription(`Successfully unmuted **${targetUser.tag}**`)
      .addFields(
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Unmute] Error:', err.message);
    await interaction.editReply('⚠️ Failed to unmute member.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to unmute members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to unmute: `.unmute @user`');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) return message.reply('❌ User not found in server.');

  try {
    // Remove timeout
    await targetMember.timeout(null, `Unmuted by ${executor.user.username}`);

    // Remove Muted role
    const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (muteRole && targetMember.roles.cache.has(muteRole.id)) {
      await targetMember.roles.remove(muteRole.id);
    }

    await addModerationAction(guild.id, targetUser.id, executor.id, 'UNMUTE', 'Unmuted by command');
    return message.reply(`✅ Unmuted **${targetUser.username}** successfully.`);
  } catch (err) {
    console.error('[Unmute Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to unmute member.');
  }
}
