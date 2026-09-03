import './dns-init.js';
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { handleStarboardReaction } from './utils/starboardManager.js';
import { Shoukaku, Connectors } from 'shoukaku';
import * as musicCmd from './commands/music.js';
import http from 'http';
import dotenv from 'dotenv';
import ffmpegPath from 'ffmpeg-static';
import dns from 'dns';

// Override DNS lookup globally to bypass developer sandbox DNS block for Lavalink servers (disable on Render)
if (!process.env.RENDER) {
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
}

process.env.FFMPEG_PATH = ffmpegPath;

import { registerCommands } from './register-commands.js';
import { handleYapMessage, startYapperMidnightCron } from './utils/levelManager.js';
import { startGiveawayCron } from './utils/giveawayCron.js';
import { recordTrackPlay } from './utils/musicStatsManager.js';

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
import * as pfpCmd from './commands/pfp.js';
import * as avatarCmd from './commands/avatar.js';
import * as nukeCmd from './commands/nuke.js';
import * as musicprofileCmd from './commands/musicprofile.js';
import * as gifCmd from './commands/gif.js';
import * as modsetchannelCmd from './commands/modsetchannel.js';
import * as mutethresholdCmd from './commands/mutethreshold.js';
import * as muteclearCmd from './commands/muteclear.js';
import * as mutesCmd from './commands/mutes.js';
import * as botnameCmd from './commands/botname.js';
import * as botavatarCmd from './commands/botavatar.js';
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

console.log('🔊 [Startup] Step 1: Initializing Shoukaku Lavalink manager...');
client.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, {
  reconnectTries: 99999, // Try to reconnect basically forever
  reconnectInterval: 10,  // Reconnect retry delay in seconds
  moveOnDisconnect: true  // Automatically move players to another active node if one disconnects
});
client.shoukaku.on('ready', (name) => console.log(`🔊 [Lavalink] Node "${name}" is connected successfully!`));
client.shoukaku.on('error', (name, error) => console.error(`🔊 [Lavalink] Node "${name}" connection error:`, error));

console.log('🔊 [Startup] Step 2: Registering commands collection...');
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
client.commands.set('pfp', pfpCmd);
client.commands.set('avatar', avatarCmd);
client.commands.set('nuke', nukeCmd);
client.commands.set('musicprofile', musicprofileCmd);
client.commands.set('gif', gifCmd);
client.commands.set('modsetchannel', modsetchannelCmd);
client.commands.set('mutethreshold', mutethresholdCmd);
client.commands.set('muteclear', muteclearCmd);
client.commands.set('mutes', mutesCmd);
client.commands.set('botname', botnameCmd);
client.commands.set('botavatar', botavatarCmd);
console.log(`🔊 [Startup] Step 2: Registered ${client.commands.size} command handlers.`);

console.log('🔊 [Startup] Step 3: Setting up ready listener...');
client.once('ready', async () => {
  console.log(`🤖 [Startup] Step 4: ProX Bot successfully logged in as ${client.user.tag}!`);
  
  console.log('🤖 [Startup] Step 5: Deploying global slash commands...');
  try {
    await registerCommands();
    console.log('🤖 [Startup] Step 5: Slash commands deployed successfully.');
  } catch (err) {
    console.error('❌ [Startup] Step 5: Failed to deploy slash commands:', err);
  }

  console.log('🤖 [Startup] Step 6: Starting giveaway scheduler...');
  try {
    startGiveawayCron(client);
    console.log('🤖 [Startup] Step 6: Giveaway scheduler started.');
  } catch (err) {
    console.error('❌ [Startup] Step 6: Failed to start giveaway scheduler:', err);
  }

  console.log('🤖 [Startup] Step 7: Starting midnight IST yapper scheduler...');
  try {
    startYapperMidnightCron(client);
    console.log('🤖 [Startup] Step 7: Midnight IST yapper scheduler started.');
  } catch (err) {
    console.error('❌ [Startup] Step 7: Failed to start yapper scheduler:', err);
  }
  
  console.log('🎉 [Startup] ProX Bot is fully ready and online!');
});

// Slash Command & Button Router
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('music_ctrl_')) {
      await musicCmd.handleMusicControl(interaction);
    }
    return;
  }
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
  if (muteRole && message.member?.roles?.cache?.has(muteRole.id)) {
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
  } else if (commandName === 'roles' && args.length === 0) {
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
  } else if (commandName === 'pfp' || commandName === 'avatar') {
    await pfpCmd.executePrefix(message, args);
  } else if (commandName === 'nuke') {
    await nukeCmd.executePrefix(message, args);
  } else if (commandName === 'musicprofile') {
    await musicprofileCmd.executePrefix(message, args);
  } else if (commandName === 'gif') {
    await gifCmd.executePrefix(message, args);
  } else if (commandName === 'modsetchannel') {
    await modsetchannelCmd.executePrefix(message, args);
  } else if (commandName === 'mutethreshold') {
    await mutethresholdCmd.executePrefix(message, args);
  } else if (commandName === 'muteclear') {
    await muteclearCmd.executePrefix(message, args);
  } else if (commandName === 'mutes') {
    await mutesCmd.executePrefix(message, args);
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
  } else if (commandName === 'botname') {
    await botnameCmd.executePrefix(message, args);
  } else if (commandName === 'botavatar') {
    await botavatarCmd.executePrefix(message, args);
  }
});

// Global server location state for region detection
let serverLocationInfo = { ip: 'Detecting...', region: 'Detecting...', country: 'Detecting...', org: 'Detecting...' };
(async () => {
  try {
    const geoRes = await fetch('https://ipapi.co/json/');
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      serverLocationInfo = {
        ip: geoData.ip || 'Unknown',
        region: geoData.city || geoData.region || 'Unknown',
        country: geoData.country_name || 'Unknown',
        org: geoData.org || 'Unknown'
      };
      console.log(`📡 [GeoIP] Server detected in: ${serverLocationInfo.region}, ${serverLocationInfo.country} (IP: ${serverLocationInfo.ip})`);
      return;
    }
  } catch (e) {}

  // Fallback
  try {
    const geoRes = await fetch('http://ip-api.com/json/');
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      serverLocationInfo = {
        ip: geoData.query || 'Unknown',
        region: geoData.city || geoData.regionName || 'Unknown',
        country: geoData.country || 'Unknown',
        org: geoData.isp || 'Unknown'
      };
      console.log(`📡 [GeoIP] Server detected in (fallback): ${serverLocationInfo.region}, ${serverLocationInfo.country} (IP: ${serverLocationInfo.ip})`);
    }
  } catch (e) {
    serverLocationInfo = { ip: 'Failed to detect', region: 'Unknown', country: 'Unknown', org: 'Unknown' };
  }
})();

// Render.com health check and status diagnostics server
const PORT = process.env.PORT || 3000;
http.createServer(async (req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    
    // 1) Test Outbound Discord API connection
    let discordApiStatus = { connected: false, status: 0, statusText: 'Unknown', rateLimited: false };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch('https://discord.com/api/v10/gateway/bot', {
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      discordApiStatus = {
        connected: response.status === 200 || response.status === 401 || response.status === 403 || response.status === 429,
        status: response.status,
        statusText: response.statusText,
        rateLimited: response.status === 429,
        retryAfter: response.headers.get('retry-after') || null
      };
    } catch (err) {
      discordApiStatus.error = err.message;
    }

    // 2) Collect Gateway Connection State
    const wsStates = { 0: 'READY', 1: 'CONNECTING', 2: 'RECONNECTING', 3: 'IDLE', 4: 'NEARLY', 5: 'DISCONNECTED' };
    const gatewayState = wsStates[client.ws.status] || 'UNKNOWN';
    const gatewayPing = client.ws.ping >= 0 ? `${client.ws.ping}ms` : 'N/A';

    // 3) Get Lavalink Nodes status
    let nodesHtml = '';
    let connectedNodes = 0;
    try {
      const nodes = Array.from(client.shoukaku.nodes.entries());
      if (nodes.length > 0) {
        nodesHtml = `
          <table>
            <thead>
              <tr>
                <th>Node Name</th>
                <th>State</th>
                <th>Active Players</th>
              </tr>
            </thead>
            <tbody>
              ${nodes.map(([name, node]) => {
                let stateClass = 'node-disconnected';
                let stateText = 'DISCONNECTED';
                if (node.state === 1 || node.state === 'CONNECTED') {
                  stateClass = 'node-connected';
                  stateText = 'CONNECTED';
                  connectedNodes++;
                } else if (node.state === 2 || node.state === 'CONNECTING') {
                  stateClass = 'node-connecting';
                  stateText = 'CONNECTING';
                }
                return `
                  <tr>
                    <td><strong>${name}</strong></td>
                    <td class="${stateClass}">${stateText}</td>
                    <td>${node.players?.size || 0}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      } else {
        nodesHtml = '<div style="color: var(--text-muted); text-align: center; padding: 10px;">No Lavalink nodes registered.</div>';
      }
    } catch (e) {
      nodesHtml = `<div style="color: var(--color-danger); padding: 10px;">Error reading nodes: ${e.message}</div>`;
    }

    // 4) System specs
    const uptimeSec = process.uptime();
    const hrs = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);
    const uptimeStr = `${hrs}h ${mins}m ${secs}s`;

    const memory = process.memoryUsage();
    const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(1) + ' MB';
    const rss = (memory.rss / 1024 / 1024).toFixed(1) + ' MB';

    // 5) Overall health status
    let overallHealth = 'success';
    let overallText = 'All Systems Operational';
    if (!discordApiStatus.connected || discordApiStatus.status === 403) {
      overallHealth = 'danger';
      overallText = 'Discord Connection Blocked (IP Banned)';
    } else if (gatewayState === 'DISCONNECTED') {
      overallHealth = 'danger';
      overallText = 'Gateway Offline';
    } else if (connectedNodes === 0) {
      overallHealth = 'warning';
      overallText = 'Lavalink Offline';
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ProX Bot Status Dashboard</title>
          <style>
              :root {
                  --bg-color: #0b0f19;
                  --card-bg: #111827;
                  --border-color: #1f2937;
                  --text-color: #f3f4f6;
                  --text-muted: #9ca3af;
                  --color-success: #10b981;
                  --color-danger: #ef4444;
                  --color-warning: #f59e0b;
                  --accent-color: #3b82f6;
              }
              body {
                  background-color: var(--bg-color);
                  color: var(--text-color);
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  margin: 0;
                  padding: 24px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  min-height: 100vh;
              }
              .container {
                  width: 100%;
                  max-width: 900px;
              }
              header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 1px solid var(--border-color);
                  padding-bottom: 16px;
                  margin-bottom: 24px;
              }
              h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.5px;
                  background: linear-gradient(135deg, #60a5fa, #3b82f6);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
              }
              .refresh-btn {
                  background: var(--accent-color);
                  color: #fff;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 6px;
                  font-weight: 600;
                  cursor: pointer;
                  text-decoration: none;
                  font-size: 13px;
                  transition: all 0.2s;
              }
              .refresh-btn:hover {
                  opacity: 0.9;
              }
              .alert-box {
                  background: rgba(239, 68, 68, 0.1);
                  border: 1px solid rgba(239, 68, 68, 0.2);
                  color: #fca5a5;
                  padding: 18px 22px;
                  border-radius: 8px;
                  font-size: 14px;
                  margin-bottom: 24px;
                  line-height: 1.6;
              }
              .alert-box ol {
                  margin: 8px 0 0 20px;
                  padding: 0;
              }
              .alert-box li {
                  margin-bottom: 6px;
              }
              .grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                  gap: 20px;
                  margin-bottom: 24px;
              }
              .card {
                  background: var(--card-bg);
                  border: 1px solid var(--border-color);
                  border-radius: 12px;
                  padding: 20px;
                  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
              }
              .card-title {
                  font-size: 13px;
                  font-weight: 700;
                  color: var(--text-muted);
                  text-transform: uppercase;
                  letter-spacing: 0.8px;
                  margin-top: 0;
                  margin-bottom: 16px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }
              .status-dot {
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  display: inline-block;
              }
              .status-dot.success { background-color: var(--color-success); box-shadow: 0 0 8px var(--color-success); }
              .status-dot.danger { background-color: var(--color-danger); box-shadow: 0 0 8px var(--color-danger); }
              .status-dot.warning { background-color: var(--color-warning); box-shadow: 0 0 8px var(--color-warning); }
              .info-row {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 12px;
                  font-size: 13px;
              }
              .info-label {
                  color: var(--text-muted);
              }
              .info-value {
                  font-weight: 600;
                  font-family: monospace;
              }
              .info-value.success { color: var(--color-success); }
              .info-value.danger { color: var(--color-danger); }
              .info-value.warning { color: var(--color-warning); }
              table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 12px;
                  text-align: left;
              }
              th, td {
                  padding: 8px 10px;
                  border-bottom: 1px solid var(--border-color);
              }
              th {
                  color: var(--text-muted);
                  font-weight: 600;
              }
              td.node-connected { color: var(--color-success); font-weight: bold; }
              td.node-connecting { color: var(--color-warning); }
              td.node-disconnected { color: var(--color-danger); }
              .footer {
                  text-align: center;
                  color: var(--text-muted);
                  font-size: 12px;
                  margin-top: 24px;
                  border-top: 1px solid var(--border-color);
                  padding-top: 16px;
              }
          </style>
          <script>
              setTimeout(() => {
                  window.location.reload();
              }, 12000);
          </script>
      </head>
      <body>
          <div class="container">
              <header>
                  <div>
                      <h1>ProX Bot Status</h1>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Health dashboard for Render deployment</div>
                  </div>
                  <button class="refresh-btn" onclick="window.location.reload()">Refresh Now</button>
              </header>

              ${!discordApiStatus.connected || discordApiStatus.status === 403 ? `
              <div class="alert-box" style="border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08);">
                  <strong style="color: #f87171; font-size: 16px; display: block; margin-bottom: 8px;">⚠️ Outbound Discord API Blocked in Region: ${serverLocationInfo.region}</strong>
                  <p style="margin: 0 0 12px 0;">Discord has blocked Render's outbound IP ranges in <strong>${serverLocationInfo.region} (${serverLocationInfo.country})</strong>. This returns HTTP 403 Forbidden, making it impossible for the bot to authenticate or connect.</p>
                  
                  <strong style="color: #fff; font-size: 13px; display: block; border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 10px; margin-top: 10px;">🛠️ ACTIONABLE SOLUTIONS:</strong>
                  <ol>
                      <li><strong>Change Render Region:</strong> Discord frequently blocks different Render regions at random times. Go to your <strong>Render Dashboard ➜ Service Settings ➜ Region</strong> and change the region from <em>${serverLocationInfo.region}</em> to a different one (e.g. Frankfurt EU, Oregon US, or Virginia US), then click save to automatically rebuild.</li>
                      <li><strong>Rotate public IP (Clear Cache & Deploy):</strong> Click the <strong>"Manual Deploy"</strong> button in Render and select <strong>"Clear build cache & deploy"</strong>. Render may assign a new host outbound node that isn't banned by Discord yet.</li>
                      <li><strong>Route through an HTTP Proxy:</strong> Set up an outbound HTTP/HTTPS Proxy inside the bot using libraries like <code>https-proxy-agent</code> to mask the Render IP address with a clean proxy IP.</li>
                  </ol>
              </div>
              ` : ''}

              <div class="grid">
                  <!-- System Status Card -->
                  <div class="card">
                      <div class="card-title">
                          System Diagnostics
                          <span class="status-dot success"></span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Bot Status</span>
                          <span class="info-value success">ONLINE</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Server Location</span>
                          <span class="info-value" style="color: #60a5fa;">${serverLocationInfo.region} (${serverLocationInfo.country})</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">IP Address</span>
                          <span class="info-value">${serverLocationInfo.ip}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Uptime</span>
                          <span class="info-value">${uptimeStr}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Memory Heap</span>
                          <span class="info-value">${heapUsed}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Memory RSS</span>
                          <span class="info-value">${rss}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Node.js Version</span>
                          <span class="info-value">${process.version}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Environment</span>
                          <span class="info-value">${process.env.RENDER ? 'Render.com Cloud' : 'Local Sandbox'}</span>
                      </div>
                  </div>

                  <!-- Discord Status Card -->
                  <div class="card">
                      <div class="card-title">
                          Discord Connection
                          <span class="status-dot ${overallHealth}"></span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Outbound API Test</span>
                          <span class="info-value ${discordApiStatus.connected && discordApiStatus.status !== 403 ? 'success' : 'danger'}">
                              ${discordApiStatus.connected && discordApiStatus.status !== 403 ? 'CLEAN (200 OK)' : `BLOCKED (${discordApiStatus.status || 'Timeout'})`}
                          </span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Gateway Connection</span>
                          <span class="info-value ${gatewayState === 'READY' ? 'success' : 'danger'}">${gatewayState}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Gateway Ping</span>
                          <span class="info-value">${gatewayPing}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Rate Limited</span>
                          <span class="info-value ${discordApiStatus.rateLimited ? 'warning' : 'success'}">${discordApiStatus.rateLimited ? 'YES' : 'NO'}</span>
                      </div>
                      ${discordApiStatus.retryAfter ? `
                      <div class="info-row">
                          <span class="info-label">Rate Limit Retry</span>
                          <span class="info-value warning">${discordApiStatus.retryAfter}s</span>
                      </div>
                      ` : ''}
                  </div>
              </div>

              <!-- Lavalink Nodes Card -->
              <div class="card" style="margin-bottom: 24px;">
                  <div class="card-title">
                      Lavalink Music Nodes
                      <span class="status-dot ${connectedNodes > 0 ? 'success' : 'danger'}"></span>
                  </div>
                  ${nodesHtml}
              </div>

              <div class="footer">
                  ProX Discord Bot Dashboard • Auto-refreshes every 10 seconds
              </div>
          </div>
      </body>
      </html>
    `;
    res.end(html);
    return;
  }

  if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      console.log('🔍 Testing outbound HTTP connection to Discord API...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://discord.com/api/v10/gateway/bot', {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`
        },
        signal: controller.signal
      });
      res.end(JSON.stringify({ 
        success: response.status === 200, 
        status: response.status 
      }));
    } catch (err) {
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'online', name: 'ProX Bot', active: client.user ? true : false }));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 ProX Bot health-check server listening on port ${PORT} (0.0.0.0)`);
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
      if (queue.songs[0]) {
        recordTrackPlay(guildId, queue.songs[0], client);
      }
      musicCmd.deleteQueue(guildId);
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
        if (queue.songs[0]) {
          recordTrackPlay(guildId, queue.songs[0], client);
        }
        await client.shoukaku.leaveVoiceChannel(guildId).catch(() => null);
        musicCmd.deleteQueue(guildId);
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

client.on('warn', (info) => console.warn(`⚠️ [Discord Warn] ${info}`));
client.on('error', (err) => console.error(`❌ [Discord Error]`, err));
if (process.env.DEBUG_DISCORD === 'true') {
  client.on('debug', (info) => console.log(`⚙️ [Discord Debug] ${info}`));
}

console.log('🔌 Connecting to Discord Gateway...');
client.login(token).catch(err => {
  console.error('❌ Failed to login to Discord:', err);
  process.exit(1);
});
