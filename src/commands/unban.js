import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server using their user ID, username, or tag')
  .setDMPermission(false)
  .addStringOption(option =>
    option.setName('user')
      .setDescription('The user ID, username, or tag (e.g. shrey#0) of the user to unban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for unbanning')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('user').trim();
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check
  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply('❌ You do not have permission to unban members.');
  }

  try {
    const banList = await guild.bans.fetch().catch(() => new Map());
    
    // Find ban entry by ID, username, or tag
    const banEntry = banList.find(b => 
      b.user.id === query || 
      b.user.username.toLowerCase() === query.toLowerCase() ||
      `${b.user.username}#${b.user.discriminator}`.toLowerCase() === query.toLowerCase()
    );

    if (!banEntry) {
      // Fallback: Assume it's a raw user ID and try to unban directly
      try {
        await guild.members.unban(query, reason);
        await addModerationAction(guild.id, query, executor.id, 'UNBAN', reason);
        
        const embed = new EmbedBuilder()
          .setColor('#16a34a')
          .setTitle('🕊️ Member Unbanned')
          .setDescription(`Successfully unbanned user ID \`${query}\``)
          .addFields(
            { name: 'Reason', value: `\`${reason}\`` },
            { name: 'Moderator', value: executor.toString() }
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch {
        return interaction.editReply(`❌ User \`${query}\` is not banned or could not be found.`);
      }
    }

    const bannedUser = banEntry.user;
    await guild.members.unban(bannedUser.id, reason);
    await addModerationAction(guild.id, bannedUser.id, executor.id, 'UNBAN', reason);

    const embed = new EmbedBuilder()
      .setColor('#16a34a')
      .setTitle('🕊️ Member Unbanned')
      .setDescription(`Successfully unbanned **${bannedUser.username}** (\`${bannedUser.id}\`)`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\`` },
        { name: 'Moderator', value: executor.toString() }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Unban] Error:', err.message);
    await interaction.editReply('⚠️ Failed to unban user. Make sure the input is correct and I have "Ban Members" permission.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    return message.reply('❌ You do not have permission to unban members.');
  }

  const query = args[0];
  if (!query) {
    return message.reply('❌ Please specify a user ID, username, or tag to unban: `.unban <user> [reason]`');
  }

  const reason = args.slice(1).join(' ') || 'No reason provided';

  try {
    const banList = await guild.bans.fetch().catch(() => new Map());
    
    const banEntry = banList.find(b => 
      b.user.id === query || 
      b.user.username.toLowerCase() === query.toLowerCase() ||
      `${b.user.username}#${b.user.discriminator}`.toLowerCase() === query.toLowerCase()
    );

    if (!banEntry) {
      // Fallback: Assume it's a raw user ID and try to unban directly
      try {
        await guild.members.unban(query, reason);
        await addModerationAction(guild.id, query, executor.id, 'UNBAN', reason);
        return message.reply(`🕊️ Successfully unbanned user ID **${query}**. Reason: \`${reason}\``);
      } catch {
        return message.reply(`❌ User \`${query}\` is not banned or could not be found.`);
      }
    }

    const bannedUser = banEntry.user;
    await guild.members.unban(bannedUser.id, reason);
    await addModerationAction(guild.id, bannedUser.id, executor.id, 'UNBAN', reason);

    return message.reply(`🕊️ Successfully unbanned **${bannedUser.username}** (${bannedUser.id}). Reason: \`${reason}\``);
  } catch (err) {
    console.error('[Unban] Prefix Error:', err.message);
    return message.reply('⚠️ Failed to unban user.');
  }
}
