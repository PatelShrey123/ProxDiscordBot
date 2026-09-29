import { SlashCommandBuilder } from 'discord.js';
import * as commandModule from './command.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List all commands available in the ProX Bot');

export async function execute(interaction) {
  await commandModule.execute(interaction);
}

export async function executePrefix(message, args) {
  await commandModule.executePrefix(message, args);
}
