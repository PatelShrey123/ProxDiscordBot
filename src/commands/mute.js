import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const muteExpirations = new Map(); // key: guildId_userId, value: timestampMs

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Temporarily mute a member in the server')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to mute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration of the mute (e.g. 5m, 2h, 1d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for muting')
      .setRequired(false)
  );

function parseDuration(str) {
  if (!str) return null;
  const regex = /^(\d+)([smhd])$/i;
  const match = str.match(regex);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return { ms: num * 1000, label: `${num}s` };
    case 'm': return { ms: num * 60 * 1000, label: `${num}m` };
    case 'h': return { ms: num * 60 * 60 * 1000, label: `${num}h` };
    case 'd': return { ms: num * 24 * 60 * 60 * 1000, label: `${num}d` };
    default: return null;
  }
}

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const durationStr = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;
  const executor = interaction.member;

  const parsed = parseDuration(durationStr);
  if (!parsed) {
    return interaction.editReply('❌ Invalid duration format. Please use e.g. `5m`, `2h`, `1d`.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to mute members.');
  }

  if (targetMember.id === guild.ownerId) {
    return interaction.editReply('❌ You cannot mute the server owner.');
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
    await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', `Muted for ${parsed.label}. Reason: ${reason}`);

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔇 Member Muted')
      .setDescription(`Successfully muted **${targetUser.tag}** for **${parsed.label}**`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    muteExpirations.set(`${guild.id}_${targetUser.id}`, Date.now() + parsed.ms);

    // Set auto-unmute timer
    setTimeout(async () => {
      try {
        const freshMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (freshMember && freshMember.roles.cache.has(muteRole.id)) {
          await freshMember.roles.remove(muteRole, 'Temporary mute expired');
          await addModerationAction(guild.id, targetUser.id, guild.members.me.id, 'UNMUTE', 'Temporary mute expired');
        }
        muteExpirations.delete(`${guild.id}_${targetUser.id}`);
      } catch (e) {
        console.error('[Mute Timeout] Auto-unmute error:', e.message);
      }
    }, parsed.ms);

  } catch (err) {
    console.error('[Mute] Error:', err.message);
    await interaction.editReply('⚠️ Failed to mute member.');
  }
}

export async function executePrefix(message, args, isUnmute = false) {
  const guild = message.guild;
  const executor = message.member;

  if (isUnmute) {
    if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ You do not have permission to unmute members.');
    }

    const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
    if (!targetUser) {
      return message.reply('❌ Please specify a user to unmute: `.unmute @user`');
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) return message.reply('❌ User not found in server.');

    const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole || !targetMember.roles.cache.has(muteRole.id)) {
      return message.reply(`ℹ️ **${targetUser.username}** is not muted.`);
    }

    try {
      await targetMember.roles.remove(muteRole, 'Unmuted by command');
      await addModerationAction(guild.id, targetUser.id, executor.id, 'UNMUTE', 'Unmuted by command');
      return message.reply(`✅ Unmuted **${targetUser.username}** successfully.`);
    } catch {
      return message.reply('⚠️ Failed to unmute.');
    }
  } else {
    // Mute Flow
    if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ You do not have permission to mute members.');
    }

    const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
    if (!targetUser) {
      return message.reply('❌ Please specify a user to mute: `.mute @user [duration: 5m/1h/2d] [reason]`');
    }

    const durationStr = args[1];
    const parsed = parseDuration(durationStr);
    if (!parsed) {
      return message.reply('❌ Please specify a valid duration string as second parameter: `.mute @user 5m [reason]`');
    }

    const reason = args.slice(2).join(' ') || 'No reason provided';
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) return message.reply('❌ User not found in server.');
    if (targetMember.id === guild.ownerId) return message.reply('❌ Cannot mute owner.');
    if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
      return message.reply('❌ Hierarchy error.');
    }
    if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
      return message.reply('❌ I cannot mute this member.');
    }

    try {
      let muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!muteRole) {
        muteRole = await guild.roles.create({ name: 'Muted', permissions: [] });
      }

      await targetMember.roles.add(muteRole, reason);
      await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', `Muted for ${parsed.label}. Reason: ${reason}`);

      muteExpirations.set(`${guild.id}_${targetUser.id}`, Date.now() + parsed.ms);

      // Set auto-unmute timer
      setTimeout(async () => {
        try {
          const freshMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (freshMember && freshMember.roles.cache.has(muteRole.id)) {
            await freshMember.roles.remove(muteRole, 'Temporary mute expired');
            await addModerationAction(guild.id, targetUser.id, guild.members.me.id, 'UNMUTE', 'Temporary mute expired');
          }
          muteExpirations.delete(`${guild.id}_${targetUser.id}`);
        } catch (e) {
          console.error('[Mute Timeout] Auto-unmute error:', e.message);
        }
      }, parsed.ms);

      return message.reply(`✅ Muted **${targetUser.username}** successfully for **${parsed.label}**. Reason: \`${reason}\``);
    } catch {
      return message.reply('⚠️ Failed to mute.');
    }
  }
}
