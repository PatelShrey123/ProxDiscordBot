import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { saveJailRecord, addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('jail')
  .setDescription('Put a member in the jar (jail)')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to jail')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for jailing')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;
  const executor = interaction.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('❌ You do not have permission to jail members.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  if (targetMember.id === guild.ownerId) {
    return interaction.editReply('❌ You cannot jail the server owner.');
  }

  if (targetMember.id === executor.id) {
    return interaction.editReply('❌ You cannot jail yourself.');
  }

  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return interaction.editReply('❌ You cannot jail this member due to role hierarchy.');
  }

  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return interaction.editReply('❌ I cannot jail this member because they have a higher or equal role hierarchy than me.');
  }

  try {
    // 1. Find or create the 'jar jailed' role
    let jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
    if (!jailRole) {
      jailRole = await guild.roles.create({
        name: 'jar jailed',
        color: '#7A5901', // Poop yellow-brown!
        reason: 'Role for jailed users'
      });
    }

    // 2. Save their current roles (excluding @everyone)
    const currentRoleIds = targetMember.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => r.id);

    await saveJailRecord(guild.id, targetUser.id, currentRoleIds);

    // 3. Strip all roles and add jail role
    await targetMember.roles.set([jailRole.id], 'Put in the jar');

    // 4. Configure the jar channel overrides and lock out all other channels
    const jarChannel = await guild.channels.fetch('1533840932481269891').catch(() => null);
    if (jarChannel) {
      await jarChannel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });
      await jarChannel.permissionOverwrites.edit(jailRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // Programmatically deny ViewChannel/SendMessages for jailRole on all other channels
    guild.channels.cache.forEach(async (chan) => {
      if (chan.id !== '1533840932481269891') {
        await chan.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => null);
      }
    });

    // 5. Save history to moderation log
    await addModerationAction(guild.id, targetUser.id, executor.id, 'JAIL', reason);

    const embed = new EmbedBuilder()
      .setColor('#7A5901')
      .setTitle('🏺 Member Jailed')
      .setDescription(`Successfully jailed **${targetUser.tag}** and put them in the jar.`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Announce in the jar channel
    if (jarChannel) {
      const jarEmbed = new EmbedBuilder()
        .setColor('#7A5901')
        .setTitle('⚖️ Jailed in the Jar')
        .setDescription(`**${targetUser}** has been sent to the jar. Only the server owner and jailed users can speak here.`)
        .addFields(
          { name: 'Reason', value: `\`${reason}\`` },
          { name: 'Jailed By', value: executor.toString() }
        )
        .setTimestamp();
      await jarChannel.send({ content: `${targetUser}`, embeds: [jarEmbed] }).catch(() => null);
    }
  } catch (err) {
    console.error('[Jail] Error:', err.message);
    await interaction.editReply('⚠️ Failed to jail member. Make sure I have Manage Roles permission.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('❌ You do not have permission to jail members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to jail: `.jail @user [reason]`');
  }

  const reason = args.slice(1).join(' ') || 'No reason provided';
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) return message.reply('❌ User not found in server.');
  if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot jail owner.');
  if (targetMember.id === executor.id) return message.reply('❌ Cannot jail yourself.');
  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return message.reply('❌ Hierarchy error.');
  }
  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return message.reply('❌ I cannot jail this member.');
  }

  try {
    let jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
    if (!jailRole) {
      jailRole = await guild.roles.create({
        name: 'jar jailed',
        color: '#7A5901',
        reason: 'Role for jailed users'
      });
    }

    const currentRoleIds = targetMember.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => r.id);

    await saveJailRecord(guild.id, targetUser.id, currentRoleIds);
    await targetMember.roles.set([jailRole.id], 'Put in the jar');

    const jarChannel = await guild.channels.fetch('1533840932481269891').catch(() => null);
    if (jarChannel) {
      await jarChannel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });
      await jarChannel.permissionOverwrites.edit(jailRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    guild.channels.cache.forEach(async (chan) => {
      if (chan.id !== '1533840932481269891') {
        await chan.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => null);
      }
    });

    await addModerationAction(guild.id, targetUser.id, executor.id, 'JAIL', reason);

    if (jarChannel) {
      const jarEmbed = new EmbedBuilder()
        .setColor('#7A5901')
        .setTitle('⚖️ Jailed in the Jar')
        .setDescription(`**${targetUser}** has been sent to the jar. Only the server owner and jailed users can speak here.`)
        .addFields(
          { name: 'Reason', value: `\`${reason}\`` },
          { name: 'Jailed By', value: executor.toString() }
        )
        .setTimestamp();
      await jarChannel.send({ content: `${targetUser}`, embeds: [jarEmbed] }).catch(() => null);
    }

    return message.reply(`🏺 Successfully jailed **${targetUser.username}** and put them in the jar.`);
  } catch (err) {
    console.error('[Jail Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to jail member.');
  }
}
