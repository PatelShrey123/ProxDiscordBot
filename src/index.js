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
import * as afkCmd from './commands/afk.js';
import * as levelCmd from './commands/level.js';
import * as unbanCmd from './commands/unban.js';
import * as jailCmd from './commands/jail.js';
import * as unjailCmd from './commands/unjail.js';
import * as permamuteCmd from './commands/permamute.js';
import * as partnershipCmd from './commands/partnership.js';
import * as modreviewCmd from './commands/modreview.js';

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
client.commands.set('afk', afkCmd);
client.commands.set('level', levelCmd);
client.commands.set('unban', unbanCmd);
client.commands.set('jail', jailCmd);
client.commands.set('unjail', unjailCmd);
client.commands.set('permamute', permamuteCmd);
client.commands.set('partnership', partnershipCmd);
client.commands.set('modreview', modreviewCmd);

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

  // Timed/Permanent Mute Message Deletion & Warning
  const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
  if (muteRole && message.member.roles.cache.has(muteRole.id)) {
    const muteKey = `${message.guild.id}_${message.author.id}`;
    const expireAt = muteCmd.muteExpirations.get(muteKey);
    const timeLeft = expireAt ? expireAt - Date.now() : 0;

    await message.delete().catch(() => null);

    let timeStr = 'permanently';
    if (timeLeft > 0) {
      const min = Math.floor(timeLeft / 60000);
      const sec = Math.floor((timeLeft % 60000) / 1000);
      timeStr = `for another **${min > 0 ? `${min}m ` : ''}${sec}s**`;
    }

    const tempMsg = await message.channel.send(`❌ ${message.author}, you are muted ${timeStr}!`).catch(() => null);
    if (tempMsg) {
      setTimeout(() => tempMsg.delete().catch(() => null), 5000);
    }
    return;
  }

  // 1. AFK welcome-back check
  if (afkCmd.afkUsers.has(message.author.id)) {
    const data = afkCmd.afkUsers.get(message.author.id);
    afkCmd.afkUsers.delete(message.author.id);
    
    const elapsedMs = Date.now() - data.timestamp;
    const sec = Math.floor((elapsedMs / 1000) % 60);
    const min = Math.floor((elapsedMs / 60000) % 60);
    const hr = Math.floor((elapsedMs / 3600000) % 24);
    const day = Math.floor(elapsedMs / 86400000);
    
    const parts = [];
    if (day > 0) parts.push(`${day}d`);
    if (hr > 0) parts.push(`${hr}h`);
    if (min > 0) parts.push(`${min}m`);
    if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
    const durationStr = parts.join(' ');

    await message.reply(`Welcome back ${message.author}! You were AFK for **${durationStr}**.`);
  }

  // 2. AFK mention responder check
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(async (user) => {
      if (user.id !== message.author.id && afkCmd.afkUsers.has(user.id)) {
        const data = afkCmd.afkUsers.get(user.id);
        const relativeTime = `<t:${Math.floor(data.timestamp / 1000)}:R>`;
        await message.reply(`💤 ${user} is AFK: **${data.reason}** - ${relativeTime}`);
      }
    });
  }

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
  } else if (commandName === 'permamute') {
    await permamuteCmd.executePrefix(message, args);
  } else if (commandName === 'partnership') {
    await partnershipCmd.executePrefix(message, args);
  } else if (commandName === 'kick') {
    await kickCmd.executePrefix(message, args);
  } else if (commandName === 'ban') {
    await banCmd.executePrefix(message, args);
  } else if (commandName === 'unban') {
    await unbanCmd.executePrefix(message, args);
  } else if (commandName === 'jail') {
    await jailCmd.executePrefix(message, args);
  } else if (commandName === 'unjail') {
    await unjailCmd.executePrefix(message, args);
  } else if (commandName === 'purge') {
    await purgeCmd.executePrefix(message, args);
  } else if (commandName === 'lock') {
    await lockCmd.executePrefix(message, args, false);
  } else if (commandName === 'unlock') {
    await lockCmd.executePrefix(message, args, true);
  } else if (commandName === 'modhistory') {
    await modhistoryCmd.executePrefix(message, args);
  } else if (commandName === 'modreview') {
    await modreviewCmd.executePrefix(message, args);
  } else if (commandName === 'giveaway') {
    await giveawayCmd.executePrefix(message, args);
  } else if (commandName === 'afk') {
    await afkCmd.executePrefix(message, args);
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
