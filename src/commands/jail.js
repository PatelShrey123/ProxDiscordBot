import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType 
} from 'discord.js';
import { 
  saveJailRecord, 
  getJailRecord, 
  removeJailRecord, 
  addModerationAction, 
  getJailRoles 
} from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('jail')
  .setDescription('Put a member in the jar (jail) and automatically create an appeal ticket')
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

/**
 * Creates or retrieves the category for all jail appeal tickets.
 */
async function getOrCreateAppealCategory(guild) {
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && 
         (c.name.toLowerCase() === '🏺 jail appeals' || c.name.toLowerCase() === 'jail appeals' || c.name.toLowerCase() === 'appeals')
  );

  if (!category) {
    try {
      category = await guild.channels.create({
        name: '🏺 JAIL APPEALS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ]
      });
    } catch (err) {
      console.warn('[Jail] Could not create category, creating standalone channel:', err.message);
    }
  }

  return category || null;
}

/**
 * Creates an isolated jail appeal ticket channel for the target user.
 */
export async function createJailAppealTicket(guild, targetUser, executor, reason, jailRole) {
  const cleanUsername = targetUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || targetUser.id;
  const channelName = `appeal-${cleanUsername}`;

  // Check if an appeal channel already exists for this user
  let existingChannel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && 
         (c.topic?.includes(targetUser.id) || c.name === channelName)
  );

  if (existingChannel) {
    return existingChannel;
  }

  const category = await getOrCreateAppealCategory(guild);

  // Fetch configured roles that are allowed to view jail appeal tickets
  const configuredRoleIds = await getJailRoles(guild.id);
  const staffRoleOverwrites = [];

  for (const roleId of configuredRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      staffRoleOverwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ]
      });
    }
  }

  const permissionOverwrites = [
    // 1. Lock out @everyone
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    },
    // 2. Lock out other jailed members
    {
      id: jailRole.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    },
    // 3. Grant the jailed target access only to this appeal ticket
    {
      id: targetUser.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    // 4. Grant bot full management
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    // 5. Configured Staff / Appeal Viewer roles
    ...staffRoleOverwrites
  ];

  const appealChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category ? category.id : null,
    topic: `Jail Appeal Ticket | User ID: ${targetUser.id} | Jailed by: ${executor.id}`,
    permissionOverwrites: permissionOverwrites,
    reason: `Jail appeal ticket for ${targetUser.tag}`
  });

  // Build the rich Embed Message requested by the user
  const embed = new EmbedBuilder()
    .setColor('#7A5901')
    .setTitle('🏺 Jail Appeal Ticket')
    .setDescription(
      `Hello ${targetUser}, you have been placed in the **Jar (Jail)**.\n\n` +
      `🔒 **You cannot see or chat in any normal channels in the server.**\n` +
      `This private ticket is your **only** place to speak with the staff team to submit an appeal.`
    )
    .addFields(
      { name: '👤 Jailed Member', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
      { name: '👮 Jailed By', value: `${executor}`, inline: true },
      { name: '📝 Reason', value: `\`${reason}\``, inline: false },
      { 
        name: '📋 How to Appeal', 
        value: 
          `1. Explain what happened calmly and honestly.\n` +
          `2. Why should staff consider releasing you?\n` +
          `3. Acknowledge the rules you broke.\n\n` +
          `*Staff will review your appeal shortly. Please remain patient and do not spam.*`, 
        inline: false 
      }
    )
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'Jail Appeal System • Staff can unjail or close this ticket using the buttons below' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`jail_ticket_unjail_${targetUser.id}`)
      .setLabel('Unjail Member')
      .setEmoji('🕊️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`jail_ticket_close_${targetUser.id}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  await appealChannel.send({
    content: `${targetUser} Your jail appeal ticket has been opened.`,
    embeds: [embed],
    components: [actionRow]
  }).catch(() => null);

  return appealChannel;
}

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
        color: '#7A5901',
        reason: 'Role for jailed users'
      });
    }

    // 2. Save their current roles
    const currentRoleIds = targetMember.roles.cache
      .filter(r => r.id !== guild.id && r.managed === false)
      .map(r => r.id);

    const saved = await saveJailRecord(guild.id, targetUser.id, currentRoleIds);
    if (!saved) {
      return interaction.editReply('❌ **Failed to backup user roles in the database.** Jailing aborted to prevent role loss. Please verify Supabase connection.');
    }

    // 3. Strip all roles and apply jail role
    await targetMember.roles.set([jailRole.id], 'Put in the jar (jailed)');

    // 4. Lock down all guild channels against jar jailed (deny view and send)
    const allChannels = await guild.channels.fetch();
    for (const [, chan] of allChannels) {
      if (chan && !chan.name.startsWith('appeal-')) {
        await chan.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => null);
      }
    }

    // 5. Automatically create the private jail appeal ticket channel with the embed
    const appealTicket = await createJailAppealTicket(guild, targetUser, executor, reason, jailRole);

    // 6. Record moderation log
    await addModerationAction(guild.id, targetUser.id, executor.id, 'JAIL', reason);

    const embed = new EmbedBuilder()
      .setColor('#7A5901')
      .setTitle('🏺 Member Jailed')
      .setDescription(`Successfully jailed **${targetUser.tag}** and locked them out of all normal channels.`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\``, inline: true },
        { name: 'Moderator', value: executor.toString(), inline: true },
        { name: 'Appeal Ticket', value: appealTicket ? appealTicket.toString() : 'Failed to create', inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Jail] Error:', err.message);
    await interaction.editReply('⚠️ Failed to jail member. Make sure I have Manage Roles and Manage Channels permissions.');
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
    return message.reply('❌ I cannot jail this member due to role hierarchy.');
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
      .filter(r => r.id !== guild.id && r.managed === false)
      .map(r => r.id);

    const saved = await saveJailRecord(guild.id, targetUser.id, currentRoleIds);
    if (!saved) {
      return message.reply('❌ **Failed to backup user roles in the database.** Jailing aborted.');
    }

    await targetMember.roles.set([jailRole.id], 'Put in the jar (jailed)');

    const allChannels = await guild.channels.fetch();
    for (const [, chan] of allChannels) {
      if (chan && !chan.name.startsWith('appeal-')) {
        await chan.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => null);
      }
    }

    const appealTicket = await createJailAppealTicket(guild, targetUser, executor, reason, jailRole);
    await addModerationAction(guild.id, targetUser.id, executor.id, 'JAIL', reason);

    const embed = new EmbedBuilder()
      .setColor('#7A5901')
      .setTitle('🏺 Member Jailed')
      .setDescription(`Successfully jailed **${targetUser.tag}**. They can only view their private appeal ticket.`)
      .addFields(
        { name: 'Reason', value: `\`${reason}\``, inline: true },
        { name: 'Moderator', value: executor.toString(), inline: true },
        { name: 'Appeal Ticket', value: appealTicket ? appealTicket.toString() : 'Failed to create', inline: false }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[Jail Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to jail member.');
  }
}

/**
 * Handles interactive buttons on Jail Appeal Tickets (Unjail and Close).
 */
export async function handleJailTicketButton(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const member = interaction.member;

  // Verify staff permissions
  if (!member.permissions.has(PermissionFlagsBits.ModerateMembers) && 
      !member.permissions.has(PermissionFlagsBits.ManageRoles) && 
      !member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ 
      content: '❌ Only staff members with moderation permissions can perform this action.', 
      ephemeral: true 
    });
  }

  // 1. Unjail Button clicked
  if (customId.startsWith('jail_ticket_unjail_')) {
    const targetUserId = customId.replace('jail_ticket_unjail_', '');
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

    await interaction.deferReply();

    try {
      const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jar jailed');
      const record = await getJailRecord(guild.id, targetUserId);

      if (targetMember) {
        if (record && record.roles && record.roles.length > 0) {
          const rolesToRestore = record.roles.filter(id => guild.roles.cache.has(id));
          await targetMember.roles.set(rolesToRestore, `Unjailed via appeal ticket by ${member.user.tag}`);
          await removeJailRecord(guild.id, targetUserId);
        } else if (jailRole) {
          await targetMember.roles.remove(jailRole, `Unjailed via appeal ticket by ${member.user.tag}`);
        }
      }

      await addModerationAction(guild.id, targetUserId, member.id, 'UNJAIL', 'Released via appeal ticket');

      await interaction.editReply({
        content: `🕊️ **${targetMember ? targetMember.user.tag : 'User'}** has been unjailed by ${member}!\nClosing and deleting this ticket in **5 seconds**...`
      });

      setTimeout(async () => {
        await interaction.channel.delete().catch(() => null);
      }, 5000);
    } catch (err) {
      console.error('[JailButton Unjail] Error:', err.message);
      await interaction.editReply({ content: `⚠️ Failed to unjail member: ${err.message}` });
    }
    return;
  }

  // 2. Close Ticket Button clicked
  if (customId.startsWith('jail_ticket_close_')) {
    await interaction.reply({
      content: `🔒 Appeal ticket closed by ${member}. Channel will be deleted in **5 seconds**...`
    });

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => null);
    }, 5000);
  }
}
