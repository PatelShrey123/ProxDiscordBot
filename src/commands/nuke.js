import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nuke')
  .setDescription('Nuke the server (troll command)');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rickrollGif = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGxhZzcwM3h1Mmh2aThzOXZ3cGlxb3J6YWV3eTBhcnN5OHZ5NnR2MiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ju7l5y9osyymQ/giphy.gif';

export async function execute(interaction) {
  await interaction.reply('💣 Nuking in 3...');
  await delay(1000);
  await interaction.editReply('💣 Nuking in 2...');
  await delay(1000);
  await interaction.editReply('💣 Nuking in 1...');
  await delay(1000);
  await interaction.editReply(`💥 **BOOM!**\n${rickrollGif}`);
}

export async function executePrefix(message, args) {
  const reply = await message.reply('💣 Nuking in 3...');
  await delay(1000);
  await reply.edit('💣 Nuking in 2...');
  await delay(1000);
  await reply.edit('💣 Nuking in 1...');
  await delay(1000);
  await reply.edit(`💥 **BOOM!**\n${rickrollGif}`);
}
