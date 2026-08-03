import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

import * as muteCmd from './commands/mute.js';
import * as kickCmd from './commands/kick.js';
import * as banCmd from './commands/ban.js';
import * as purgeCmd from './commands/purge.js';
import * as lockCmd from './commands/lock.js';
import * as modhistoryCmd from './commands/modhistory.js';
import * as giveawayCmd from './commands/giveaway.js';
import * as musicCmd from './commands/music.js';
import * as levelCmd from './commands/level.js';

const commands = [
  muteCmd.data.toJSON(),
  kickCmd.data.toJSON(),
  banCmd.data.toJSON(),
  purgeCmd.data.toJSON(),
  lockCmd.data.toJSON(),
  modhistoryCmd.data.toJSON(),
  giveawayCmd.data.toJSON(),
  musicCmd.data.toJSON(),
  levelCmd.data.toJSON()
];

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.APPLICATION_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN or APPLICATION_ID is missing from environments!');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

export async function registerCommands() {
  try {
    console.log(`⏳ Starting deployment of ${commands.length} application (/) commands...`);
    
    // Register commands globally
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log(`✅ Successfully deployed ${data.length} global application (/) commands!`);
  } catch (error) {
    console.error('❌ Error deploying application commands:', error);
  }
}

// Support running command registry script directly
if (process.argv[1] && (process.argv[1].endsWith('register-commands.js') || process.argv[1].endsWith('register-commands'))) {
  registerCommands();
}
