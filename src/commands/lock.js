import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock this channel (prevents everyone from sending messages)')
  .setDMPermission(false);

export async function execute(interaction, isUnlock = false) {
  await interaction.deferReply();
  const channel = interaction.channel;
  const guild = interaction.guild;

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply('❌ You do not have permission to manage channels.');
  }

  if (!channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('❌ I do not have permission to manage channel role overrides.');
  }

  try {
    const everyoneRole = guild.roles.everyone;
    
    if (isUnlock) {
      // Unlock: set SendMessages to null (default) or true
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
      
      const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle('🔓 Channel Unlocked')
        .setDescription(`This channel has been successfully unlocked by **${interaction.user.tag}**. Members can now chat.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      // Lock: set SendMessages to false
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
      
      const embed = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('🔒 Channel Locked')
        .setDescription(`This channel has been locked by **${interaction.user.tag}**. Send messages permission disabled for everyone.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Lock] Error:', err.message);
    await interaction.editReply('⚠️ Failed to modify channel overrides.');
  }
}

export async function executePrefix(message, args, isUnlock = false) {
  const channel = message.channel;
  const guild = message.guild;
  const executor = message.member;

  if (!executor.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ You do not have permission to manage channels.');
  }

  try {
    const everyoneRole = guild.roles.everyone;
    if (isUnlock) {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
      return message.reply('🔓 **Channel Unlocked!** Members can now speak in this channel.');
    } else {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
      return message.reply('🔒 **Channel Locked!** Everyone is muted in this channel.');
    }
  } catch {
    return message.reply('⚠️ Failed to update channel lock permissions.');
  }
}
