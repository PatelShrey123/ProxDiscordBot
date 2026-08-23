import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction, getMuteSettings, getUserMuteCount } from '../api/db.js';

export const muteExpirations = new Map(); // Kept for index.js import compatibility (empty now since Discord native timeout handles timed mutes)

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Temporarily mute (timeout) a member in the server')
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
      .setRequired(true)
  );

function parseDuration(str) {
  if (!str) return null;
  const regex = /^(\d+)([smhd])$/i;
  const match = str.match(regex);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return { ms: num * 1000, label: `${num} seconds` };
    case 'm': return { ms: num * 60 * 1000, label: `${num} minutes` };
    case 'h': return { ms: num * 60 * 60 * 1000, label: `${num} hours` };
    case 'd': return { ms: num * 24 * 60 * 60 * 1000, label: `${num} days` };
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

  // Max Discord native timeout is 28 days
  if (parsed.ms > 28 * 24 * 60 * 60 * 1000) {
    return interaction.editReply('❌ Native Discord timeout duration cannot exceed 28 days. For permanent mutes, use `/permamute`.');
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
    return interaction.editReply('❌ Hierarchy error. You cannot mute this member.');
  }

  if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
    return interaction.editReply('❌ Bot hierarchy error. I cannot mute this member.');
  }

  try {
    // Perform native timeout
    await targetMember.timeout(parsed.ms, `${reason} (Muted by ${executor.user.username})`);
    
    // Log action
    await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', `Muted (Timeout) for ${parsed.label}. Reason: ${reason}`);

    // Post to logs channel and check mute threshold
    try {
      const { mute_channel_id, mute_threshold } = await getMuteSettings(guild.id);
      const muteCount = await getUserMuteCount(guild.id, targetUser.id);

      if (mute_channel_id) {
        const logChannel = await guild.channels.fetch(mute_channel_id).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor('#f59e0b')
            .setTitle('🔇 Member Muted')
            .setDescription(`**${targetUser.tag}** has been muted.`)
            .addFields(
              { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
              { name: 'Moderator', value: `${executor} (${executor.user.id})`, inline: true },
              { name: 'Mute Count', value: `\`${muteCount}/${mute_threshold}\``, inline: true },
              { name: 'Duration', value: parsed.label, inline: true },
              { name: 'Reason', value: reason }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });

          if (muteCount >= mute_threshold) {
            try {
              await targetMember.ban({ reason: `Exceeded mute threshold (${muteCount}/${mute_threshold})` });
              
              const banEmbed = new EmbedBuilder()
                .setColor('#ef4444')
                .setTitle('🔨 Automatically Banned')
                .setDescription(`**${targetUser.tag}** has been automatically banned because they hit the mute threshold limit (\`${muteCount}/${mute_threshold}\`).`)
                .setTimestamp();

              await logChannel.send({ embeds: [banEmbed] });
            } catch (banErr) {
              console.error('[AutoBan] Failed to ban user:', banErr.message);
              await logChannel.send(`⚠️ Failed to automatically ban **${targetUser.tag}** after hitting the limit. Please verify my permissions and hierarchy.`);
            }
          }
        }
      }
    } catch (logErr) {
      console.error('[Mute Log] Error:', logErr.message);
    }

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔇 Member Muted (Timeout)')
      .setDescription(`Successfully timed out **${targetUser.tag}** for **${parsed.label}**. Haha, loser!`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Mute] Error:', err.message);
    await interaction.editReply('⚠️ Failed to timeout member. Make sure I have Moderate Members permission.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

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

  if (parsed.ms > 28 * 24 * 60 * 60 * 1000) {
    return message.reply('❌ Native Discord timeout duration cannot exceed 28 days. For permanent mutes, use `.permamute`.');
  }

  const reason = args.slice(2).join(' ');
  if (!reason) {
    return message.reply('❌ Please specify a reason for muting: `.mute @user [duration: 5m/1h/2d] [reason]`');
  }

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
    await targetMember.timeout(parsed.ms, `${reason} (Muted by ${executor.user.username})`);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'MUTE', `Muted (Timeout) for ${parsed.label}. Reason: ${reason}`);

    // Post to logs channel and check mute threshold
    try {
      const { mute_channel_id, mute_threshold } = await getMuteSettings(guild.id);
      const muteCount = await getUserMuteCount(guild.id, targetUser.id);

      if (mute_channel_id) {
        const logChannel = await guild.channels.fetch(mute_channel_id).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor('#f59e0b')
            .setTitle('🔇 Member Muted')
            .setDescription(`**${targetUser.tag}** has been muted.`)
            .addFields(
              { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
              { name: 'Moderator', value: `${executor} (${executor.user.id})`, inline: true },
              { name: 'Mute Count', value: `\`${muteCount}/${mute_threshold}\``, inline: true },
              { name: 'Duration', value: parsed.label, inline: true },
              { name: 'Reason', value: reason }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });

          if (muteCount >= mute_threshold) {
            try {
              await targetMember.ban({ reason: `Exceeded mute threshold (${muteCount}/${mute_threshold})` });
              
              const banEmbed = new EmbedBuilder()
                .setColor('#ef4444')
                .setTitle('🔨 Automatically Banned')
                .setDescription(`**${targetUser.tag}** has been automatically banned because they hit the mute threshold limit (\`${muteCount}/${mute_threshold}\`).`)
                .setTimestamp();

              await logChannel.send({ embeds: [banEmbed] });
            } catch (banErr) {
              console.error('[AutoBan] Failed to ban user:', banErr.message);
              await logChannel.send(`⚠️ Failed to automatically ban **${targetUser.tag}** after hitting the limit. Please verify my permissions and hierarchy.`);
            }
          }
        }
      }
    } catch (logErr) {
      console.error('[Mute Log] Error:', logErr.message);
    }

    return message.reply(`✅ Muted **${targetUser.username}** successfully with a Discord timeout for **${parsed.label}**. Reason: \`${reason}\`. Haha, loser!`);
  } catch (err) {
    console.error('[Mute Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to mute member.');
  }
}
