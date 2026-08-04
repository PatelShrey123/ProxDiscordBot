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
import * as afkCmd from './commands/afk.js';
import * as levelCmd from './commands/level.js';
import * as unbanCmd from './commands/unban.js';
import * as jailCmd from './commands/jail.js';
import * as unjailCmd from './commands/unjail.js';
import * as unmuteCmd from './commands/unmute.js';
import * as permamuteCmd from './commands/permamute.js';
import * as partnershipCmd from './commands/partnership.js';
import * as modreviewCmd from './commands/modreview.js';
import * as rolesCmd from './commands/roles.js';
import * as commandCmd from './commands/command.js';
import * as levelrewardsCmd from './commands/levelrewards.js';
import * as yapperdailyCmd from './commands/yapperdaily.js';
import * as yapperweeklyCmd from './commands/yapperweekly.js';
import * as disableCmd from './commands/disable.js';
import * as enableCmd from './commands/enable.js';
import * as setupjailCmd from './commands/setupjail.js';
import * as starboardCmd from './commands/starboard.js';

const commands = [
  muteCmd.data.toJSON(),
  kickCmd.data.toJSON(),
  banCmd.data.toJSON(),
  purgeCmd.data.toJSON(),
  lockCmd.data.toJSON(),
  modhistoryCmd.data.toJSON(),
  giveawayCmd.data.toJSON(),
  afkCmd.data.toJSON(),
  levelCmd.data.toJSON(),
  unbanCmd.data.toJSON(),
  jailCmd.data.toJSON(),
  unjailCmd.data.toJSON(),
  permamuteCmd.data.toJSON(),
  partnershipCmd.data.toJSON(),
  modreviewCmd.data.toJSON(),
  rolesCmd.data.toJSON(),
  commandCmd.data.toJSON(),
  levelrewardsCmd.data.toJSON(),
  yapperdailyCmd.data.toJSON(),
  yapperweeklyCmd.data.toJSON(),
  disableCmd.data.toJSON(),
  enableCmd.data.toJSON(),
  setupjailCmd.data.toJSON(),
  unmuteCmd.data.toJSON(),
  starboardCmd.data.toJSON()
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
