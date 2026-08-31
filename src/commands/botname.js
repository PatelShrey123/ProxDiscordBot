import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('botname')
  .setDescription('Rename the bot in this server (Server Owner only)')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('The new nickname for the bot (leave empty to reset)')
      .setRequired(false)
  );

export async function execute(interaction) {
  if (interaction.user.id !== interaction.guild.ownerId) {
    return interaction.reply({
      content: '❌ Only the Server Owner can change the bot\'s name in this server!',
      flags: 64 // ephemeral
    });
  }

  const newName = interaction.options.getString('name') || null;

  try {
    const botMember = interaction.guild.members.me || await interaction.guild.members.fetch(interaction.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.ChangeNickname) && newName !== null) {
      return interaction.reply({
        content: '❌ I do not have the `Change Nickname` permission in this server!',
        flags: 64
      });
    }

    await botMember.setNickname(newName);
    return interaction.reply({
      content: newName 
        ? `✅ Successfully changed my nickname to **${newName}** in this server!`
        : `✅ Successfully reset my nickname in this server!`
    });
  } catch (err) {
    console.error('Error in botname command:', err);
    return interaction.reply({
      content: `⚠️ Failed to change nickname: ${err.message}`,
      flags: 64
    });
  }
}

export async function executePrefix(message, args) {
  if (!message.guild) return;
  if (message.author.id !== message.guild.ownerId) {
    return message.reply('❌ Only the Server Owner can use this command!');
  }

  const newName = args.join(' ').trim() || null;

  try {
    const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id);
    await botMember.setNickname(newName);
    return message.reply(newName 
      ? `✅ Successfully changed my nickname to **${newName}** in this server!`
      : `✅ Successfully reset my nickname in this server!`
    );
  } catch (err) {
    console.error('Error in botname prefix command:', err);
    return message.reply(`⚠️ Failed to change nickname: ${err.message}`);
  }
}
