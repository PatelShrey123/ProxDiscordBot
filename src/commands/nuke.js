import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nuke')
  .setDescription('Nuke the server (troll command)');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rickrollGif = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGxhZzcwM3h1Mmh2aThzOXZ3cGlxb3J6YWV3eTBhcnN5OHZ5NnR2MiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ju7l5y9osyymQ/giphy.gif';

export async function execute(interaction) {
  const member = interaction.member;
  const botMember = interaction.guild.members.me || await interaction.guild.members.fetch(interaction.client.user.id);

  // Check if member role position is higher than bot's highest role position
  if (member.id !== interaction.guild.ownerId && member.roles.highest.position <= botMember.roles.highest.position) {
    return interaction.reply({
      content: '❌ You must have a role higher than the Prox Bot\'s highest role to use this command!',
      flags: 64 // ephemeral
    });
  }

  await interaction.reply('💣 Nuking in 3...');
  await delay(1000);
  await interaction.editReply('💣 Nuking in 2...');
  await delay(1000);
  await interaction.editReply('💣 Nuking in 1...');
  await delay(1000);
  await interaction.editReply(`💥 **BOOM!**\n${rickrollGif}`);
}

export async function executePrefix(message, args) {
  if (!message.guild) return;
  const member = message.member || await message.guild.members.fetch(message.author.id);
  const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id);

  // Check if member role position is higher than bot's highest role position
  if (member.id !== message.guild.ownerId && member.roles.highest.position <= botMember.roles.highest.position) {
    return message.reply('❌ You must have a role higher than the Prox Bot\'s highest role to use this command!');
  }

  const reply = await message.reply('💣 Nuking in 3...');
  await delay(1000);
  await reply.edit('💣 Nuking in 2...');
  await delay(1000);
  await reply.edit('💣 Nuking in 1...');
  await delay(1000);
  await reply.edit(`💥 **BOOM!**\n${rickrollGif}`);
}
