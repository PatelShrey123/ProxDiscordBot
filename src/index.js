import { Client, GatewayIntentBits, Collection } from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';
import ffmpegPath from 'ffmpeg-static';

process.env.FFMPEG_PATH = ffmpegPath;

import { registerCommands } from './register-commands.js';
import { handleYapMessage } from './utils/levelManager.js';
import { startGiveawayCron } from './utils/giveawayCron.js';

import * as muteCmd from './commands/mute.js';
import * as kickCmd from './commands/kick.js';
import * as banCmd from './commands/ban.js';
import * as purgeCmd from './commands/purge.js';
import * as lockCmd from './commands/lock.js';
import * as modhistoryCmd from './commands/modhistory.js';
import * as giveawayCmd from './commands/giveaway.js';
import * as musicCmd from './commands/music.js';
import * as levelCmd from './commands/level.js';
import * as unbanCmd from './commands/unban.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is missing! Please configure it in your environments.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.commands = new Collection();
client.commands.set('mute', muteCmd);
client.commands.set('kick', kickCmd);
client.commands.set('ban', banCmd);
client.commands.set('purge', purgeCmd);
client.commands.set('lock', lockCmd);
client.commands.set('modhistory', modhistoryCmd);
client.commands.set('giveaway', giveawayCmd);
client.commands.set('music', musicCmd);
client.commands.set('level', levelCmd);
client.commands.set('unban', unbanCmd);

client.once('ready', async () => {
  console.log(`🤖 ProX Bot successfully logged in as ${client.user.tag}!`);
  
  // Register Slash commands
  await registerCommands();

  // Start Giveaway timer checks
  startGiveawayCron(client);
});

// Slash Command Router
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Music Command routing
  if (['play', 'skip', 'stop', 'queue'].includes(interaction.options.getSubcommand(false))) {
    const musicCommand = client.commands.get('music');
    try {
      await musicCommand.execute(interaction);
    } catch (err) {
      console.error('[SlashRouter] Music execution error:', err.message);
      await interaction.reply({ content: '⚠️ Failed to execute music subcommand.', flags: 64 });
    }
    return;
  }

  // Level Command routing
  if (['rank', 'leaderboard'].includes(interaction.options.getSubcommand(false))) {
    const levelCommand = client.commands.get('level');
    try {
      await levelCommand.execute(interaction);
    } catch (err) {
      console.error('[SlashRouter] Level execution error:', err.message);
      await interaction.reply({ content: '⚠️ Failed to execute level subcommand.', flags: 64 });
    }
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[SlashRouter] Command execution error on /${interaction.commandName}:`, error);
    const msg = { content: '⚠️ An error occurred while executing this command!', flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

// Prefix Command & Yapping XP Router
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  
  // Award leveling/yap XP
  await handleYapMessage(message);

  if (!content.startsWith('.')) return;

  const args = content.slice(1).split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Route Prefix Commands
  if (commandName === 'mute') {
    await muteCmd.executePrefix(message, args, false);
  } else if (commandName === 'unmute') {
    await muteCmd.executePrefix(message, args, true);
  } else if (commandName === 'kick') {
    await kickCmd.executePrefix(message, args);
  } else if (commandName === 'ban') {
    await banCmd.executePrefix(message, args);
  } else if (commandName === 'unban') {
    await unbanCmd.executePrefix(message, args);
  } else if (commandName === 'purge') {
    await purgeCmd.executePrefix(message, args);
  } else if (commandName === 'lock') {
    await lockCmd.executePrefix(message, args, false);
  } else if (commandName === 'unlock') {
    await lockCmd.executePrefix(message, args, true);
  } else if (commandName === 'modhistory') {
    await modhistoryCmd.executePrefix(message, args);
  } else if (commandName === 'giveaway') {
    await giveawayCmd.executePrefix(message, args);
  } else if (['play', 'skip', 'stop', 'queue'].includes(commandName)) {
    await musicCmd.executePrefix(message, args, commandName);
  } else if (['rank', 'leaderboard', 'yappers'].includes(commandName)) {
    await levelCmd.executePrefix(message, args, commandName);
  }
});

// Render.com lightweight health check endpoint
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'online', name: 'ProX Bot', active: client.user ? true : false }));
}).listen(PORT, () => {
  console.log(`📡 ProX Bot health-check server listening on port ${PORT}`);
});

client.login(token);
