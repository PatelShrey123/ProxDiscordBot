import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete a specified number of messages from this channel')
  .setDMPermission(false)
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const amount = interaction.options.getInteger('amount');
  const channel = interaction.channel;

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.editReply('❌ You do not have permission to purge messages.');
  }

  if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
    return interaction.editReply('❌ I do not have permission to manage messages in this channel.');
  }

  try {
    const deleted = await channel.bulkDelete(amount, true);
    await interaction.editReply(`✅ Successfully deleted **${deleted.size}** messages.`);
  } catch (err) {
    console.error('[Purge] Error:', err.message);
    await interaction.editReply('⚠️ Failed to purge messages. Note: Discord does not support bulk deleting messages older than 14 days.');
  }
}

export async function executePrefix(message, args) {
  const executor = message.member;
  const channel = message.channel;

  if (!executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply('❌ You do not have permission to purge messages.');
  }

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount < 1 || amount > 100) {
    return message.reply('❌ Please specify a valid number of messages to delete (1-100): `.purge [amount]`');
  }

  try {
    // Delete the command trigger message first
    await message.delete().catch(() => null);

    const deleted = await channel.bulkDelete(amount, true);
    const reply = await channel.send(`✅ Successfully purged **${deleted.size}** messages.`);
    
    // Auto-delete success notification after 3 seconds
    setTimeout(() => reply.delete().catch(() => null), 3000);
  } catch {
    return message.reply('⚠️ Failed to purge messages. Note: Discord does not support bulk deleting messages older than 14 days.');
  }
}
