import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createGiveaway, getGiveaway } from '../api/db.js';
import { processGiveawayEnd } from '../utils/giveawayCron.js';

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Manage server giveaways')
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand.setName('start')
      .setDescription('Start a new giveaway')
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Duration (e.g. 10s, 5m, 2h, 1d)')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('winners')
          .setDescription('Number of winners')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option.setName('prize')
          .setDescription('The prize description')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('end')
      .setDescription('End an active giveaway immediately')
      .addStringOption(option =>
        option.setName('message_id')
          .setDescription('The giveaway message ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('reroll')
      .setDescription('Reroll winners for an ended giveaway')
      .addStringOption(option =>
        option.setName('message_id')
          .setDescription('The giveaway message ID')
          .setRequired(true)
      )
  );

// Parse time helper (returns epoch ms of end date)
function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return Date.now() + val * 1000;
    case 'm': return Date.now() + val * 60 * 1000;
    case 'h': return Date.now() + val * 60 * 60 * 1000;
    case 'd': return Date.now() + val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();
  const executor = interaction.member;

  if (!executor.permissions.has(PermissionFlagsBits.ManageEvents) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply('❌ You do not have permission to manage giveaways.');
  }

  if (subcommand === 'start') {
    const durStr = interaction.options.getString('duration');
    const winnersCount = interaction.options.getInteger('winners');
    const prize = interaction.options.getString('prize');

    const endsAtTimestamp = parseDuration(durStr);
    if (!endsAtTimestamp) {
      return interaction.editReply('❌ Invalid duration format. Examples: `30s`, `5m`, `2h`, `1d`.');
    }

    const channel = interaction.channel;
    const endsUnix = Math.floor(endsAtTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setTitle('🎁 GIVEAWAY START 🎁')
      .setColor('#fbbf24')
      .setDescription(`**Prize:** ${prize}\n**React with 🎉 to enter!**\n**Winners:** \`${winnersCount}\`\n**Ends:** <t:${endsUnix}:F> (<t:${endsUnix}:R>)`)
      .setFooter({ text: 'Giveaway active!' })
      .setTimestamp();

    // Send the giveaway message to the channel
    const msg = await channel.send({ embeds: [embed] });
    await msg.react('🎉');

    // Create database log
    await createGiveaway(interaction.guildId, channel.id, msg.id, prize, winnersCount, new Date(endsAtTimestamp).toISOString());

    await interaction.editReply('✅ Giveaway started successfully!');
  } else if (subcommand === 'end') {
    const msgId = interaction.options.getString('message_id');
    const gw = await getGiveaway(msgId);

    if (!gw || gw.guild_id !== interaction.guildId) {
      return interaction.editReply('❌ No active giveaway matching that message ID found in this server.');
    }

    if (gw.status === 'ENDED') {
      return interaction.editReply('❌ That giveaway has already ended.');
    }

    // Call ending helper immediately
    await processGiveawayEnd(interaction.client, gw);
    await interaction.editReply('✅ Giveaway ended successfully!');
  } else if (subcommand === 'reroll') {
    const msgId = interaction.options.getString('message_id');
    const gw = await getGiveaway(msgId);

    if (!gw || gw.guild_id !== interaction.guildId) {
      return interaction.editReply('❌ No giveaway matching that message ID found in this server.');
    }

    // Call drawing function with fresh random
    await processGiveawayEnd(interaction.client, { ...gw, status: 'ACTIVE' }); // Force status mock active for drawing
    await interaction.editReply('✅ Giveaway rerolled successfully!');
  }
}

export async function executePrefix(message, args) {
  const executor = message.member;
  const guild = message.guild;

  if (!executor.permissions.has(PermissionFlagsBits.ManageEvents) && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply('❌ You do not have permission to manage giveaways.');
  }

  const action = args[0]?.toLowerCase();
  if (action === 'start') {
    const durStr = args[1];
    const winnersCount = parseInt(args[2]);
    const prize = args.slice(3).join(' ');

    if (!durStr || isNaN(winnersCount) || !prize) {
      return message.reply('❌ Invalid format. Use: `.giveaway start [duration] [winners] [prize]` (e.g. `.giveaway start 1m 1 Steam Key`)');
    }

    const endsAtTimestamp = parseDuration(durStr);
    if (!endsAtTimestamp) {
      return message.reply('❌ Invalid duration format. Examples: `30s`, `5m`, `2h`, `1d`.');
    }

    const endsUnix = Math.floor(endsAtTimestamp / 1000);
    const embed = new EmbedBuilder()
      .setTitle('🎁 GIVEAWAY START 🎁')
      .setColor('#fbbf24')
      .setDescription(`**Prize:** ${prize}\n**React with 🎉 to enter!**\n**Winners:** \`${winnersCount}\`\n**Ends:** <t:${endsUnix}:F> (<t:${endsUnix}:R>)`)
      .setFooter({ text: 'Giveaway active!' })
      .setTimestamp();

    try {
      const msg = await message.channel.send({ embeds: [embed] });
      await msg.react('🎉');
      await createGiveaway(guild.id, message.channel.id, msg.id, prize, winnersCount, new Date(endsAtTimestamp).toISOString());
    } catch {
      return message.reply('⚠️ Failed to start giveaway.');
    }
  } else if (action === 'end') {
    const msgId = args[1];
    if (!msgId) return message.reply('❌ Message ID required: `.giveaway end [message_id]`');

    const gw = await getGiveaway(msgId);
    if (!gw || gw.guild_id !== guild.id) return message.reply('❌ Giveaway not found.');
    if (gw.status === 'ENDED') return message.reply('❌ Already ended.');

    await processGiveawayEnd(message.client, gw);
    return message.reply('✅ Giveaway ended.');
  } else if (action === 'reroll') {
    const msgId = args[1];
    if (!msgId) return message.reply('❌ Message ID required: `.giveaway reroll [message_id]`');

    const gw = await getGiveaway(msgId);
    if (!gw || gw.guild_id !== guild.id) return message.reply('❌ Giveaway not found.');

    await processGiveawayEnd(message.client, { ...gw, status: 'ACTIVE' });
    return message.reply('✅ Giveaway rerolled.');
  } else {
    return message.reply('❌ Unknown command action. Use `.giveaway start`, `.giveaway end`, or `.giveaway reroll`.');
  }
}
