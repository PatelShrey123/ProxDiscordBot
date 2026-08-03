import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('permamute')
  .setDescription('Permanently mute a member in the server')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to permamute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for permamuting')
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

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to permamute members.');
  }

  if (targetMember.id === guild.ownerId) {
    return interaction.editReply('❌ You cannot permamute the server owner.');
  }

  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return interaction.editReply('❌ Hierarchy error.');
  }

  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return interaction.editReply('❌ Bot hierarchy error.');
  }

  try {
    let muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) {
      muteRole = await guild.roles.create({
        name: 'Muted',
        permissions: [],
        reason: 'Required for mute command functionality'
      });
      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased()) {
          await channel.permissionOverwrites.create(muteRole, {
            SendMessages: false,
            AddReactions: false
          }).catch(() => {});
        }
      }
    }

    if (targetMember.roles.cache.has(muteRole.id)) {
      return interaction.editReply(`ℹ️ **${targetUser.username}** is already muted.`);
    }

    await targetMember.roles.add(muteRole, reason);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'PERMAMUTE', reason);

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔇 Member Permanently Muted')
      .setDescription(`Successfully permamuted **${targetUser.tag}**`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Permamute] Error:', err.message);
    await interaction.editReply('⚠️ Failed to permamute member.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to permamute members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to permamute: `.permamute @user [reason]`');
  }

  const reason = args.slice(1).join(' ') || 'No reason provided';
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) return message.reply('❌ User not found in server.');
  if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot permamute owner.');
  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return message.reply('❌ Hierarchy error.');
  }
  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return message.reply('❌ I cannot permamute this member.');
  }

  try {
    let muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) {
      muteRole = await guild.roles.create({ name: 'Muted', permissions: [] });
    }

    await targetMember.roles.add(muteRole, reason);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'PERMAMUTE', reason);

    return message.reply(`✅ Permanently Muted **${targetUser.username}** successfully. Reason: \`${reason}\``);
  } catch {
    return message.reply('⚠️ Failed to permamute.');
  }
}
