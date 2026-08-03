import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setupjail')
  .setDescription('Set up the jail role, channel, and lock down channel permissions')
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only administrators or manage channels
  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply('❌ You do not have permission to run jail setup.');
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

    // 2. Find or create the text channel 'jar-jail'
    let jarChannel = guild.channels.cache.find(c => 
      (c.name.toLowerCase() === 'jar-jail' || c.name.toLowerCase() === 'jar-jailed') && c.type === 0
    );

    if (!jarChannel) {
      jarChannel = await guild.channels.create({
        name: 'jar-jail',
        type: 0, // GuildText
        reason: 'Jail text channel created by bot setup'
      });
    }

    // 3. Configure jail channel overrides
    if (jarChannel && jailRole) {
      await jarChannel.permissionOverwrites.set([
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: jailRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: guild.members.me.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }
      ]).catch(() => null);
    }

    // 4. Fetch all channels in the guild to guarantee cache completion
    const allChannels = await guild.channels.fetch();
    let lockedCount = 0;

    for (const [id, chan] of allChannels) {
      if (jarChannel && chan.id !== jarChannel.id) {
        // Edit overrides to deny view and send permission
        await chan.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => null);
        lockedCount++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#7A5901')
      .setTitle('🏺 Jail System Setup Complete')
      .setDescription('Successfully initialized jail parameters on this server.')
      .addFields(
        { name: 'Jail Channel', value: jarChannel ? jarChannel.toString() : 'None', inline: true },
        { name: 'Jail Role', value: jailRole ? jailRole.toString() : 'None', inline: true },
        { name: 'Locked Channels', value: `\`${lockedCount}\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[SetupJail] Error:', err.message);
    await interaction.editReply('⚠️ Failed to complete jail setup. Make sure I have Administrator / Manage Channels / Manage Roles permissions.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ You do not have permission to run jail setup.');
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

    let jarChannel = guild.channels.cache.find(c => 
      (c.name.toLowerCase() === 'jar-jail' || c.name.toLowerCase() === 'jar-jailed') && c.type === 0
    );

    if (!jarChannel) {
      jarChannel = await guild.channels.create({
        name: 'jar-jail',
        type: 0,
        reason: 'Jail text channel'
      });
    }

    if (jarChannel && jailRole) {
      await jarChannel.permissionOverwrites.set([
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: jailRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: guild.members.me.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }
      ]).catch(() => null);
    }

    const allChannels = await guild.channels.fetch();
    let lockedCount = 0;

    for (const [id, chan] of allChannels) {
      if (jarChannel && chan.id !== jarChannel.id) {
        await chan.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => null);
        lockedCount++;
      }
    }

    return message.reply(`✅ **Jail Setup Complete!** Created role 'jar jailed', text channel ${jarChannel}, and locked down ${lockedCount} other channels.`);
  } catch (err) {
    console.error('[SetupJail Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to complete jail setup.');
  }
}
