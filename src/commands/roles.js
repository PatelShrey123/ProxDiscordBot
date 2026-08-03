import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('List all server roles with their IDs');

export async function execute(interaction) {
  const guild = interaction.guild;
  const roles = [...guild.roles.cache.values()]
    .filter(r => r.id !== guild.id) // exclude @everyone
    .sort((a, b) => b.position - a.position);

  const totalRoles = roles.length;
  if (totalRoles === 0) {
    return interaction.reply('ℹ️ This server has no roles.');
  }

  const itemsPerPage = 25;
  const totalPages = Math.ceil(totalRoles / itemsPerPage);
  let currentPage = 1;

  const generateEmbed = (page) => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageRoles = roles.slice(start, end);

    const description = pageRoles.map(r => `${r.toString()} ${r.id}`).join('\n');

    return new EmbedBuilder()
      .setColor('#3b82f6') // Blue left border
      .setDescription(description)
      .setFooter({ 
        text: `Confused? React with i for more info.\nPage ${page}/${totalPages} (${totalRoles} entries)` 
      });
  };

  const generateButtons = (page) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages)
    );
  };

  const embed = generateEmbed(currentPage);
  const row = generateButtons(currentPage);

  const reply = await interaction.reply({ 
    embeds: [embed], 
    components: totalPages > 1 ? [row] : [],
    fetchReply: true 
  });

  if (totalPages > 1) {
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minute collector
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ Only the command executor can change pages.', flags: 64 });
      }

      if (i.customId === 'prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage = Math.min(totalPages, currentPage + 1);
      }

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
      });
    });

    collector.on('end', async () => {
      // Disable buttons on timeout
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
  }
}

export async function executePrefix(message, args) {
  const guild = message.guild;
  const roles = [...guild.roles.cache.values()]
    .filter(r => r.id !== guild.id) // exclude @everyone
    .sort((a, b) => b.position - a.position);

  const totalRoles = roles.length;
  if (totalRoles === 0) {
    return message.reply('ℹ️ This server has no roles.');
  }

  const itemsPerPage = 25;
  const totalPages = Math.ceil(totalRoles / itemsPerPage);
  let currentPage = 1;

  const generateEmbed = (page) => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageRoles = roles.slice(start, end);

    const description = pageRoles.map(r => `${r.toString()} ${r.id}`).join('\n');

    return new EmbedBuilder()
      .setColor('#3b82f6')
      .setDescription(description)
      .setFooter({ 
        text: `Confused? React with i for more info.\nPage ${page}/${totalPages} (${totalRoles} entries)` 
      });
  };

  const generateButtons = (page) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages)
    );
  };

  const embed = generateEmbed(currentPage);
  const row = generateButtons(currentPage);

  const reply = await message.reply({ 
    embeds: [embed], 
    components: totalPages > 1 ? [row] : [] 
  });

  if (totalPages > 1) {
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: '❌ Only the command executor can change pages.', flags: 64 });
      }

      if (i.customId === 'prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage = Math.min(totalPages, currentPage + 1);
      }

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
      });
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      await reply.edit({ components: [disabledRow] }).catch(() => null);
    });
  }
}
