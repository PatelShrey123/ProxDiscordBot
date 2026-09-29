import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getJailRecord, removeJailRecord, addModerationAction } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('unjail')
  .setDescription('Release a member from the jar (jail) and close their appeal ticket')
  .setDMPermission(false)
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The member to unjail')
      .setRequired(true)
  );

/**
 * Finds and deletes the appeal ticket channel for a user after a brief countdown.
 */
async function closeAppealTicket(guild, targetUserId, cleanUsername) {
  const channel = guild.channels.cache.find(c => 
    c.name.startsWith('appeal-') && 
    (c.topic?.includes(targetUserId) || c.name === `appeal-${cleanUsername}`)
  );

  if (channel) {
    await channel.send('🕊️ **User has been unjailed.** This appeal ticket will be deleted in **5 seconds**...').catch(() => null);
    setTimeout(async () => {
      await channel.delete().catch(() => null);
    }, 5000);
    return channel;
  }
  return null;
}

export async function execute(interaction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('target');
  const guild = interaction.guild;
  const executor = interaction.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('❌ You do not have permission to unjail members.');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply('❌ That user is not in this server.');
  }

  try {
    const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
    
    // 1. Get saved roles from database
    const record = await getJailRecord(guild.id, targetUser.id);
    
    if (record && record.roles && record.roles.length > 0) {
      // 2. Restore saved roles
      const rolesToRestore = record.roles.filter(id => guild.roles.cache.has(id));
      await targetMember.roles.set(rolesToRestore, `Released from jail by ${executor.user.tag}`);
      await removeJailRecord(guild.id, targetUser.id);
    } else {
      // 3. Fallback: just remove jail role if no database record exists
      if (jailRole) {
        await targetMember.roles.remove(jailRole, `Released from jail by ${executor.user.tag} (no backup roles found)`);
      }
    }

    // 4. Save history to moderation log
    await addModerationAction(guild.id, targetUser.id, executor.id, 'UNJAIL', 'Released from the jar');

    // 5. Automatically clean up appeal ticket channel
    const cleanUsername = targetUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || targetUser.id;
    const closedTicket = await closeAppealTicket(guild, targetUser.id, cleanUsername);

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle('🕊️ Member Unjailed')
      .setDescription(`Successfully released **${targetUser.tag}** from the jar and restored their roles.`)
      .addFields(
        { name: 'Moderator', value: executor.toString(), inline: true },
        { name: 'Appeal Ticket', value: closedTicket ? 'Closed & scheduled for deletion' : 'No open ticket found', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Unjail] Error:', err.message);
    await interaction.editReply('⚠️ Failed to unjail member. Check my role permissions.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) && !executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('❌ You do not have permission to unjail members.');
  }

  const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
  if (!targetUser) {
    return message.reply('❌ Please specify a user to unjail: `.unjail @user`');
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) return message.reply('❌ User not found in server.');

  try {
    const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
    const record = await getJailRecord(guild.id, targetUser.id);
    
    if (record && record.roles && record.roles.length > 0) {
      const rolesToRestore = record.roles.filter(id => guild.roles.cache.has(id));
      await targetMember.roles.set(rolesToRestore, `Released from jail by ${executor.user.tag}`);
      await removeJailRecord(guild.id, targetUser.id);
    } else {
      if (jailRole) {
        await targetMember.roles.remove(jailRole, `Released from jail by ${executor.user.tag}`);
      }
    }

    await addModerationAction(guild.id, targetUser.id, executor.id, 'UNJAIL', 'Released from the jar');

    const cleanUsername = targetUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || targetUser.id;
    const closedTicket = await closeAppealTicket(guild, targetUser.id, cleanUsername);

    return message.reply(`🕊️ Successfully unjailed **${targetUser.username}** and restored their roles.${closedTicket ? ' Closed appeal ticket channel.' : ''}`);
  } catch (err) {
    console.error('[Unjail Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to unjail member.');
  }
}
