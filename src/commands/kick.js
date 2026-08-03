import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to kick')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for kicking')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;

  const executor = interaction.member;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  // Hierarchy & Permissions Check
  if (!executor.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.editReply('❌ You do not have permission to kick members.');
  }

  if (targetMember.id === guild.ownerId) {
    return interaction.editReply('❌ You cannot kick the server owner.');
  }

  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return interaction.editReply('❌ You cannot kick this member because they have a higher or equal role hierarchy than you.');
  }

  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return interaction.editReply('❌ I cannot kick this member because they have a higher or equal role hierarchy than me.');
  }

  try {
    await targetMember.kick(reason);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'KICK', reason);

    const embed = new EmbedBuilder()
      .setColor('#fb923c')
      .setTitle('👢 Member Kicked')
      .setDescription(`Successfully kicked **${targetUser.tag}**`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Kick] Error:', err.message);
    await interaction.editReply('⚠️ Failed to kick member. Check my role permissions.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.KickMembers)) {
    return message.reply('❌ You do not have permission to kick members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to kick: `.kick @user [reason]`');
  }

  const reason = args.slice(1).join(' ') || 'No reason provided';
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) return message.reply('❌ User not found in server.');
  if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot kick owner.');
  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return message.reply('❌ Hierarchy error.');
  }
  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return message.reply('❌ I cannot kick this member.');
  }

  try {
    await targetMember.kick(reason);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'KICK', reason);
    return message.reply(`✅ Successfully kicked **${targetUser.username}**. Reason: \`${reason}\``);
  } catch {
    return message.reply('⚠️ Failed to kick.');
  }
}
