import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server using their user ID')
  .setDMPermission(false)
  .addStringOption(option =>
    option.setName('userid')
      .setDescription('The Discord ID of the user to unban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for unbanning')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const userId = interaction.options.getString('userid').trim();
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check
  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply('❌ You do not have permission to unban members.');
  }

  try {
    // Attempt to fetch banned user to verify they are banned and get their tag
    const banList = await guild.bans.fetch().catch(() => new Map());
    const banEntry = banList.get(userId);
    
    if (!banEntry) {
      // Sometimes fetching the whole list might fail or they might want to force-unban, let's try anyway
      try {
        await guild.members.unban(userId, reason);
        await addModerationAction(guild.id, userId, executor.id, 'UNBAN', reason);
        const embed = new EmbedBuilder()
          .setColor('#16a34a')
          .setTitle('🕊️ Member Unbanned')
          .setDescription(`Successfully unbanned user ID \`${userId}\``)
          .addFields(
            { name: 'Reason', value: `\`${reason}\`` },
            { name: 'Moderator', value: executor.toString() }
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch {
        return interaction.editReply(`❌ User ID \`${userId}\` is not banned or could not be found.`);
      }
    }

    const bannedUser = banEntry.user;
    await guild.members.unban(userId, reason);
    await addModerationAction(guild.id, userId, executor.id, 'UNBAN', reason);

    const embed = new EmbedBuilder()
      .setColor('#16a34a')
      .setTitle('🕊️ Member Unbanned')
      .setDescription(`Successfully unbanned **${bannedUser.tag}** (\`${userId}\`)`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Unban] Error:', err.message);
    await interaction.editReply('⚠️ Failed to unban user. Make sure the ID is correct and I have "Ban Members" permission.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return message.reply('❌ You do not have permission to unban members.');
  }

  const userId = args[0];
  if (!userId) {
    return message.reply('❌ Please specify a user ID to unban: `.unban <userid> [reason]`');
  }

  const reason = args.slice(1).join(' ') || 'No reason provided';

  try {
    const banList = await guild.bans.fetch().catch(() => new Map());
    const banEntry = banList.get(userId);
    const bannedUser = banEntry ? banEntry.user : null;
    
    await guild.members.unban(userId, reason);
    await addModerationAction(guild.id, userId, executor.id, 'UNBAN', reason);

    const targetLabel = bannedUser ? `${bannedUser.username} (${userId})` : `ID: ${userId}`;
    return message.reply(`🕊️ Successfully unbanned **${targetLabel}**. Reason: \`${reason}\``);
  } catch (err) {
    console.error('[Unban] Prefix Error:', err.message);
    return message.reply('⚠️ Failed to unban. Make sure the ID is correct and is actually banned.');
  }
}
