import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setupjail')
  .setDescription('Set up the jail role, appeals category, and lock down channel permissions')
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
        color: '#7A5901',
        reason: 'Role for jailed users'
      });
    }

    // 2. Find or create the '🏺 JAIL APPEALS' category
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && 
           (c.name.toLowerCase() === '🏺 jail appeals' || c.name.toLowerCase() === 'jail appeals' || c.name.toLowerCase() === 'appeals')
    );

    if (!category) {
      category = await guild.channels.create({
        name: '🏺 JAIL APPEALS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: jailRole.id,
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ],
        reason: 'Category for jail appeal tickets'
      });
    }

    // 3. Fetch all channels in the guild and lock them down
    const allChannels = await guild.channels.fetch();
    let lockedCount = 0;

    for (const [, chan] of allChannels) {
      if (chan && chan.id !== category.id && !chan.name.startsWith('appeal-')) {
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
      .setDescription('Successfully initialized jail parameters and locked down all server channels.')
      .addFields(
        { name: 'Jail Role', value: jailRole ? jailRole.toString() : 'None', inline: true },
        { name: 'Appeals Category', value: category ? `📁 ${category.name}` : 'None', inline: true },
        { name: 'Channels Locked', value: `\`${lockedCount}\``, inline: true },
        { 
          name: '⚙️ Next Steps for Staff Roles', 
          value: 'Use **`/jailroles add <role>`** or **`.jailroles add @role`** to specify which staff roles can view and manage new appeal tickets!', 
          inline: false 
        }
      )
      .setFooter({ text: 'Jailed users will have zero access to normal channels and will only receive an appeal ticket' })
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

    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && 
           (c.name.toLowerCase() === '🏺 jail appeals' || c.name.toLowerCase() === 'jail appeals' || c.name.toLowerCase() === 'appeals')
    );

    if (!category) {
      category = await guild.channels.create({
        name: '🏺 JAIL APPEALS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: jailRole.id,
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ],
        reason: 'Category for jail appeal tickets'
      });
    }

    const allChannels = await guild.channels.fetch();
    let lockedCount = 0;

    for (const [, chan] of allChannels) {
      if (chan && chan.id !== category.id && !chan.name.startsWith('appeal-')) {
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
      .setDescription('Successfully initialized jail parameters and locked down all server channels.')
      .addFields(
        { name: 'Jail Role', value: jailRole ? jailRole.toString() : 'None', inline: true },
        { name: 'Appeals Category', value: category ? `📁 ${category.name}` : 'None', inline: true },
        { name: 'Channels Locked', value: `\`${lockedCount}\``, inline: true },
        { 
          name: '⚙️ Next Steps for Staff Roles', 
          value: 'Use **`.jailroles add @role`** to configure which staff/moderator roles can view new appeal tickets!', 
          inline: false 
        }
      )
      .setFooter({ text: 'Jailed users will have zero access to normal channels and will only receive an appeal ticket' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[SetupJail Prefix] Error:', err.message);
    return message.reply('⚠️ Failed to complete jail setup.');
  }
}
