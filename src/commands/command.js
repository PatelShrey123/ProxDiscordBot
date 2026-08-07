import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('command')
  .setDescription('List all commands available in the ProX Bot');

const embedHelp = new EmbedBuilder()
  .setColor('#10b981')
  .setTitle('🎮 ProX Bot Commands list')
  .setDescription('Here is a complete list of all prefix (`.`) and slash (`/`) commands you can use:')
  .addFields(
    {
      name: '🛡️ Moderation Commands',
      value: [
        '• **`.kick @member [reason]`** / **`/kick`** — Kick a member.',
        '• **`.ban @member [reason]`** / **`/ban`** — Ban a member.',
        '• **`.unban [userid] [reason]`** / **`/unban`** — Unban a user using their ID.',
        '• **`.mute @member [duration: 5m/2h/1d] [reason]`** / **`/mute`** — Temporarily mute a member.',
        '• **`.permamute @member [reason]`** / **`/permamute`** — Permanently mute a member.',
        '• **`.unmute @member`** — Unmute a member.',
        '• **`.jail @member [reason]`** / **`/jail`** — Jail a user (lock them in jar channel and strip roles).',
        '• **`.unjail @member`** / **`/unjail`** — Unjail a user and restore their original roles.',
        '• **`.lock`** / **`/lock`** — Lock the current text channel.',
        '• **`.unlock`** / **`/unlock`** — Unlock the current text channel.',
        '• **`.purge [1-100]`** / **`/purge`** — Bulk delete messages.',
        '• **`.modhistory @member`** / **`/modhistory`** — View last 10 moderation logs of a member.',
        '• **`.modreview @moderator`** / **`/modreview`** — View last 3 moderation actions taken by a moderator.'
      ].join('\n')
    },
    {
      name: '🎁 Giveaway Commands',
      value: [
        '• **`.giveaway start [time: 5m/1h/2d] [winnersCount] [prize]`** — Start a giveaway.',
        '• **`.giveaway end [message_id]`** — Force draw a giveaway immediately.',
        '• **`.giveaway reroll [message_id]`** — Draw a new winner for a giveaway.'
      ].join('\n')
    },
    {
      name: '📈 Leveling & Yapping Stats',
      value: [
        '• **`.rank [@member]`** / **`/level rank`** — View level, XP, and yapping count.',
        '• **`.leaderboard`** (or `.yappers`) / **`/level leaderboard`** — View the top 10 yappers.',
        '• **`.levelrewards [enable/disable]`** / **`/levelrewards`** — Enable or disable automatic level roles.',
        '• **`.disable level`** / **`/disable level`** — Disable leveling/yap XP tracking completely.',
        '• **`.enable level`** / **`/enable level`** — Enable leveling/yap XP tracking completely.',
        '• **`.yapperdaily`** (or `.yapper daily`) / **`/yapperdaily`** — View the top 5 daily yappers.',
        '• **`.yapperweekly`** (or `.yapper weekly`) / **`/yapperweekly`** — View the top 5 weekly yappers.'
      ].join('\n')
    },
    {
      name: '💤 AFK Status',
      value: [
        '• **`.afk [status]`** / **`/afk`** — Set your AFK status reason. Mentions of you will report this status. Speaking again clears it.'
      ].join('\n')
    },
    {
      name: '🤝 Partnerships',
      value: [
        '• **`.partnership`** / **`/partnership`** — Print the PROx partnership ad block.'
      ].join('\n')
    },
    {
      name: '⚙️ Utilities',
      value: [
        '• **`.roles`** / **`/roles`** — Display a paginated list of all server roles with their IDs.',
        '• **`.command`** / **`/command`** — Show this help menu.',
        '• **`.setupjail`** / **`/setupjail`** — Automatically set up jail roles and channel configurations.',
        '• **`.starboard`** / **`/starboard`** — Configure starboard channel, status, and reaction thresholds.',
        '• **`.levelchannel`** / **`/levelchannel`** — Configure a custom level-up and yapper winner announcements channel.',
        '• **`.stream`** / **`/stream`** — Generate a quick voice channel join link and start streaming.',
        '• **`.music`** (or `.play`) / **`/music`** — Search and play music in voice channels via remote Lavalink.',
        '• **`.stopmusic`** (or `.stop`, `.leave`) / **`/stopmusic`** — Stop the music, clear the queue, and leave the voice channel.'
      ].join('\n')
    }
  )
  .setTimestamp();

export async function execute(interaction) {
  await interaction.reply({ embeds: [embedHelp] });
}

export async function executePrefix(message, args) {
  return message.reply({ embeds: [embedHelp] });
}
