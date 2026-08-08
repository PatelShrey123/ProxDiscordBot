import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction, getUserWarnCount } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user and auto-ban at 5 warnings')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The user to warn')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the warning (compulsory)')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason');
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Must have ModerateMembers permission
  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ You do not have permission to warn members.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (targetMember) {
    if (targetMember.id === guild.ownerId) {
      return interaction.editReply('❌ You cannot warn the server owner.');
    }
    if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
      return interaction.editReply('❌ You cannot warn this member because they have a higher or equal role hierarchy than you.');
    }
  }

  try {
    // 1. Add warn entry to DB
    await addModerationAction(guild.id, targetUser.id, executor.id, 'WARN', reason);

    // 2. Fetch new warn count
    const warnCount = await getUserWarnCount(guild.id, targetUser.id);

    if (warnCount >= 5) {
      // 3. Auto Ban
      if (targetMember && !targetMember.bannable) {
        return interaction.editReply(`⚠️ **${targetUser.username}** has reached **${warnCount}** warnings, but I do not have permission to ban them.`);
      }

      await guild.members.ban(targetUser.id, { reason: `Auto-ban: Reached 5 warnings. Last warning reason: ${reason}` });
      await addModerationAction(guild.id, targetUser.id, interaction.client.user.id, 'BAN', 'Auto-ban: Reached 5 warnings.');

      const embed = new EmbedBuilder()
        .setColor('#dc2626')
        .setTitle('🔨 Automatic Ban')
        .setDescription(`**${targetUser.tag}** has been automatically banned for reaching **5 warnings**.`)
        .addFields(
          { name: 'Last Warning Reason', value: `\`${reason}\`` },
          { name: 'Moderator', value: executor.toString() }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } else {
      // 4. Standard Warning
      const embed = new EmbedBuilder()
        .setColor('#eab308')
        .setTitle('⚠️ Member Warned')
        .setDescription(`Successfully warned **${targetUser.tag}**`)
        .addFields(
          { name: 'Reason', value: `\`${reason}\`` },
          { name: 'Warnings Count', value: `\`${warnCount} / 5\`` },
          { name: 'Moderator', value: executor.toString() }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Warn Command Error]:', err.message);
    return interaction.editReply('⚠️ An error occurred while trying to warn the user.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ You do not have permission to warn members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to warn: `.warn @user <reason>` or `.warn [user_id] <reason>`');
  }

  const reason = args.slice(1).join(' ');
  if (!reason) {
    return message.reply('❌ A warning reason is compulsory! Example: `.warn @user Swearing in chat`');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  if (targetMember) {
    if (targetMember.id === guild.ownerId) return message.reply('❌ You cannot warn the server owner.');
    if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
      return message.reply('❌ Hierarchy error: You cannot warn this member.');
    }
  }

  try {
    await addModerationAction(guild.id, targetUser.id, executor.id, 'WARN', reason);
    const warnCount = await getUserWarnCount(guild.id, targetUser.id);

    if (warnCount >= 5) {
      if (targetMember && !targetMember.bannable) {
        return message.reply(`⚠️ **${targetUser.username}** has reached **${warnCount}** warnings, but I cannot ban them due to role hierarchy.`);
      }

      await guild.members.ban(targetUser.id, { reason: `Auto-ban: Reached 5 warnings. Last warning reason: ${reason}` });
      await addModerationAction(guild.id, targetUser.id, message.client.user.id, 'BAN', 'Auto-ban: Reached 5 warnings.');

      return message.reply(`🔨 **${targetUser.username}** has been automatically banned for reaching **5 warnings**. Reason: \`${reason}\``);
    } else {
      return message.reply(`⚠️ **${targetUser.username}** has been warned by **${executor.user.username}**! [Warns: ${warnCount}/5]\n**Reason:** \`${reason}\``);
    }
  } catch (err) {
    console.error('[Warn Prefix Error]:', err.message);
    return message.reply('⚠️ Failed to warn member.');
  }
}
