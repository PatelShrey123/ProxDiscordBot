import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to ban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for banning')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;

  const executor = interaction.member;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  // Hierarchy & Permissions Check
  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply('❌ You do not have permission to ban members.');
  }

  if (targetMember) {
    if (targetMember.id === guild.ownerId) {
      return interaction.editReply('❌ You cannot ban the server owner.');
    }

    if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
      return interaction.editReply('❌ You cannot ban this member because they have a higher or equal role hierarchy than you.');
    }

    if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
      return interaction.editReply('❌ I cannot ban this member because they have a higher or equal role hierarchy than me.');
    }
  }

  try {
    await guild.members.ban(targetUser.id, { reason });
    await addModerationAction(guild.id, targetUser.id, executor.id, 'BAN', reason);

    const embed = new EmbedBuilder()
      .setColor('#dc2626')
      .setTitle('🔨 Member Banned')
      .setDescription(`Successfully banned **${targetUser.tag}**`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Ban] Error:', err.message);
    await interaction.editReply('⚠️ Failed to ban member. Check my role permissions.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return message.reply('❌ You do not have permission to ban members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to ban: `.ban @user [reason]`');
  }

  const reason = args.slice(1).join(' ') || 'No reason provided';
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (targetMember) {
    if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot ban owner.');
    if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
      return message.reply('❌ Hierarchy error.');
    }
    if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
      return message.reply('❌ I cannot ban this member.');
    }
  }

  try {
    await guild.members.ban(targetUser.id, { reason });
    await addModerationAction(guild.id, targetUser.id, executor.id, 'BAN', reason);
    return message.reply(`✅ Successfully banned **${targetUser.username}**. Reason: \`${reason}\``);
  } catch {
    return message.reply('⚠️ Failed to ban.');
  }
}
