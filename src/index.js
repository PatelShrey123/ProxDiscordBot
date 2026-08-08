import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { handleStarboardReaction } from './utils/starboardManager.js';
import { Shoukaku, Connectors } from 'shoukaku';
import * as musicCmd from './commands/music.js';
import http from 'http';
import dotenv from 'dotenv';
import ffmpegPath from 'ffmpeg-static';
import dns from 'dns';

// Override DNS lookup globally to bypass developer sandbox DNS block for Lavalink servers
const originalLookup = dns.lookup;
const dnsMap = {
  'lava-v4.ajieblogs.eu.org': '38.46.216.241',
  'lavalinkv4.serenetia.com': '38.46.216.241',
  'lavalink.jirayu.net': '150.136.105.0',
  'dns4.jirayu.net': '150.136.105.0',
  'lavalink-v4.triniumhost.com': '104.21.22.149',
  'nodelink.triniumhost.com': '104.21.22.149',
  'nodelink-02.triniumhost.com': '104.21.22.149',
  'lava-v4.millohost.my.id': '104.21.52.221'
};

dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  if (dnsMap[hostname]) {
    const address = dnsMap[hostname];
    const family = 4;
    
    if (options && options.all) {
      return callback(null, [{ address, family }]);
    }
    return callback(null, address, family);
  }
  
  return originalLookup(hostname, options, callback);
};

process.env.FFMPEG_PATH = ffmpegPath;

import { registerCommands } from './register-commands.js';
import { handleYapMessage } from './utils/levelManager.js';
import { startGiveawayCron } from './utils/giveawayCron.js';

import * as muteCmd from './commands/mute.js';
import * as kickCmd from './commands/kick.js';
import * as banCmd from './commands/ban.js';
import * as unmuteCmd from './commands/unmute.js';
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
import * as rolesCmd from './commands/roles.js';
import * as commandCmd from './commands/command.js';
import * as levelrewardsCmd from './commands/levelrewards.js';
import * as yapperdailyCmd from './commands/yapperdaily.js';
import * as yapperweeklyCmd from './commands/yapperweekly.js';
import * as disableCmd from './commands/disable.js';
import * as enableCmd from './commands/enable.js';
import * as setupjailCmd from './commands/setupjail.js';
import * as starboardCmd from './commands/starboard.js';
import * as levelchannelCmd from './commands/levelchannel.js';
import * as streamCmd from './commands/stream.js';
import * as stopmusicCmd from './commands/stopmusic.js';
import * as skipCmd from './commands/skip.js';
import * as warnCmd from './commands/warn.js';
import * as warnhistoryCmd from './commands/warnhistory.js';
import { saveRolesBackup, getRolesBackup, removeRolesBackup } from './api/db.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is missing! Please configure it in your environments.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Enable members intent for leave/join event triggers
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User]
});

const Nodes = [
  {
    name: 'lavalink.jirayu.net',
    url: 'lavalink.jirayu.net:443',
    auth: 'youshallnotpass',
    secure: true
  },
  {
    name: 'lavalink-v4.triniumhost.com',
    url: 'lavalink-v4.triniumhost.com:443',
    auth: 'free',
    secure: true
  },
  {
    name: 'nodelink.triniumhost.com',
    url: 'nodelink.triniumhost.com:443',
    auth: 'free',
    secure: true
  },
  {
    name: 'nodelink-02.triniumhost.com',
    url: 'nodelink-02.triniumhost.com:443',
    auth: 'trinium',
    secure: true
  },
  {
    name: 'lava-v4.millohost.my.id',
    url: 'lava-v4.millohost.my.id:443',
    auth: 'https://discord.gg/mjS5J2K3ep',
    secure: true
  },
  {
    name: 'lava-v4.ajieblogs.eu.org',
    url: 'lava-v4.ajieblogs.eu.org:80',
    auth: 'https://dsc.gg/ajidevserver',
    secure: false
  },
  {
    name: 'lavalinkv4.serenetia.com',
    url: 'lavalinkv4.serenetia.com:443',
    auth: 'https://seretia.link/discord',
    secure: true
  }
];

client.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);
client.shoukaku.on('ready', (name) => console.log(`🔊 [Lavalink] Node "${name}" is connected successfully!`));
client.shoukaku.on('error', (name, error) => console.error(`🔊 [Lavalink] Node "${name}" connection error:`, error));

client.commands = new Collection();
client.commands.set('mute', muteCmd);
client.commands.set('kick', kickCmd);
client.commands.set('ban', banCmd);
client.commands.set('unmute', unmuteCmd);
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
client.commands.set('roles', rolesCmd);
client.commands.set('command', commandCmd);
client.commands.set('levelrewards', levelrewardsCmd);
client.commands.set('yapperdaily', yapperdailyCmd);
client.commands.set('yapperweekly', yapperweeklyCmd);
client.commands.set('disable', disableCmd);
client.commands.set('enable', enableCmd);
client.commands.set('setupjail', setupjailCmd);
client.commands.set('starboard', starboardCmd);
client.commands.set('levelchannel', levelchannelCmd);
client.commands.set('stream', streamCmd);
client.commands.set('music', musicCmd);
client.commands.set('stopmusic', stopmusicCmd);
client.commands.set('skip', skipCmd);
client.commands.set('warn', warnCmd);
client.commands.set('warnhistory', warnhistoryCmd);

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
    await unmuteCmd.executePrefix(message, args);
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
  } else if (commandName === 'roles' || commandName === 'role') {
    await rolesCmd.executePrefix(message, args);
  } else if (commandName === 'command' || commandName === 'commands' || commandName === 'help') {
    await commandCmd.executePrefix(message, args);
  } else if (commandName === 'levelrewards') {
    await levelrewardsCmd.executePrefix(message, args);
  } else if (commandName === 'disable') {
    await disableCmd.executePrefix(message, args);
  } else if (commandName === 'enable') {
    await enableCmd.executePrefix(message, args);
  } else if (commandName === 'setupjail') {
    await setupjailCmd.executePrefix(message, args);
  } else if (commandName === 'starboard') {
    await starboardCmd.executePrefix(message, args);
  } else if (commandName === 'levelchannel') {
    await levelchannelCmd.executePrefix(message, args);
  } else if (commandName === 'stream') {
    await streamCmd.executePrefix(message, args);
  } else if (commandName === 'music' || commandName === 'play') {
    await musicCmd.executePrefix(message, args);
  } else if (commandName === 'stopmusic' || commandName === 'stop' || commandName === 'leave') {
    await stopmusicCmd.executePrefix(message, args);
  } else if (commandName === 'skip' || commandName === 's') {
    await skipCmd.executePrefix(message, args);
  } else if (commandName === 'warn') {
    await warnCmd.executePrefix(message, args);
  } else if (commandName === 'warnhistory') {
    await warnhistoryCmd.executePrefix(message, args);
  } else if (commandName === 'yapperdaily') {
    await yapperdailyCmd.executePrefix(message, args);
  } else if (commandName === 'yapperweekly') {
    await yapperweeklyCmd.executePrefix(message, args);
  } else if (commandName === 'yapper') {
    const sub = args[0]?.toLowerCase();
    if (sub === 'daily') {
      await yapperdailyCmd.executePrefix(message, args.slice(1));
    } else if (sub === 'weekly') {
      await yapperweeklyCmd.executePrefix(message, args.slice(1));
    } else {
      await message.reply('❌ Please specify: `.yapper daily` or `.yapper weekly`');
    }
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

// Automatic roles backup on member leave/kick/ban
client.on('guildMemberRemove', async (member) => {
  const guild = member.guild;
  const roleIds = member.roles.cache
    .filter(r => r.id !== guild.id && r.managed === false)
    .map(r => r.id);
  if (roleIds.length > 0) {
    await saveRolesBackup(guild.id, member.user.id, roleIds);
  }
});

// Automatic roles restoration on member rejoin
client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;
  const record = await getRolesBackup(guild.id, member.user.id);
  if (record && record.roles && record.roles.length > 0) {
    const rolesToRestore = record.roles.filter(id => guild.roles.cache.has(id));
    if (rolesToRestore.length > 0) {
      await member.roles.add(rolesToRestore, 'Restoring backup roles on rejoin').catch(() => null);
    }
    // Delete record to avoid storing unnecessary data
    await removeRolesBackup(guild.id, member.user.id);
  }
});

// Starboard reaction addition listener
client.on('messageReactionAdd', async (reaction, user) => {
  await handleStarboardReaction(reaction, user);
});

// Starboard reaction removal listener
client.on('messageReactionRemove', async (reaction, user) => {
  await handleStarboardReaction(reaction, user);
});

// Automatic empty Voice Channel 3-minute disconnection listener
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild.id;
  const queue = musicCmd.queues.get(guildId);
  if (!queue) return;

  const botVoiceChannel = newState.guild.members.me?.voice.channel;
  if (!botVoiceChannel) {
    if (oldState.member.id === client.user.id && !newState.channelId) {
      if (queue.emptyVcTimeout) clearTimeout(queue.emptyVcTimeout);
      if (queue.inactivityTimeout) clearTimeout(queue.inactivityTimeout);
      musicCmd.queues.delete(guildId);
    }
    return;
  }

  const activeMembers = botVoiceChannel.members.filter(m => !m.user.bot);
  if (activeMembers.size === 0) {
    if (!queue.emptyVcTimeout) {
      if (queue.textChannel) {
        await queue.textChannel.send('⚠️ The voice channel is empty. The bot will leave in 3 minutes if no one rejoins.').catch(() => null);
      }
      queue.emptyVcTimeout = setTimeout(async () => {
        await client.shoukaku.leaveVoiceChannel(guildId).catch(() => null);
        if (queue.inactivityTimeout) clearTimeout(queue.inactivityTimeout);
        musicCmd.queues.delete(guildId);
        if (queue.textChannel) {
          await queue.textChannel.send('🎶 Disconnected from voice channel because it was empty for 3 minutes.').catch(() => null);
        }
      }, 3 * 60 * 1000);
    }
  } else {
    if (queue.emptyVcTimeout) {
      clearTimeout(queue.emptyVcTimeout);
      queue.emptyVcTimeout = null;
      if (queue.textChannel) {
        await queue.textChannel.send('✨ Someone joined the voice channel. Disconnection timer cancelled!').catch(() => null);
      }
    }
  }
});

client.login(token);
