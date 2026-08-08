import { SlashCommandBuilder } from 'discord.js';
import * as pfp from './pfp.js';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription("Get a user's profile picture / avatar")
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose avatar you want to view')
      .setRequired(false)
  );

export const execute = pfp.execute;
export const executePrefix = pfp.executePrefix;
