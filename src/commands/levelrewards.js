import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setLevelRewardsStatus } from '../api/db.js';

export const data = new SlashCommandBuilder()
  .setName('levelrewards')
  .setDescription('Enable or disable automatic level role milestone rewards')
  .setDMPermission(false)
  .addStringOption(option =>
    option.setName('status')
      .setDescription('Set status (enable or disable)')
      .setRequired(true)
      .addChoices(
        { name: 'Enable', value: 'enable' },
        { name: 'Disable', value: 'disable' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const status = interaction.options.getString('status');
  const guild = interaction.guild;
  const executor = interaction.member;

  // Permissions Check: Only Server Owner or those with Manage Guild permissions
  const isOwner = executor.id === guild.ownerId;
  const hasManageGuild = executor.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !hasManageGuild) {
    return interaction.editReply('❌ Only the server owner or members with `Manage Guild` permission can configure level rewards.');
  }

  const enabled = status === 'enable';
  const success = await setLevelRewardsStatus(guild.id, enabled);

  if (success) {
    return interaction.editReply(`✅ Successfully **${enabled ? 'enabled' : 'disabled'}** level role milestone rewards for this server.`);
  } else {
    return interaction.editReply('⚠️ Failed to save settings to the database.');
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const executor = message.member;

  const isOwner = executor.id === guild.ownerId;
  const hasManageGuild = executor.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !hasManageGuild) {
    return message.reply('❌ Only the server owner or members with `Manage Guild` permission can configure level rewards.');
  }

  const status = args[0]?.toLowerCase();
  if (status !== 'enable' && status !== 'disable') {
    return message.reply('❌ Please specify a status: `.levelrewards enable` or `.levelrewards disable`');
  }

  const enabled = status === 'enable';
  const success = await setLevelRewardsStatus(guild.id, enabled);

  if (success) {
    return message.reply(`✅ Successfully **${enabled ? 'enabled' : 'disabled'}** level role milestone rewards.`);
  } else {
    return message.reply('⚠️ Failed to save settings to the database.');
  }
}
