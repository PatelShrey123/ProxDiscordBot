import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const afkUsers = new Map(); // key: userId, value: { reason: string, timestamp: number }

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Set your AFK status')
  .addStringOption(option =>
    option.setName('status')
      .setDescription('AFK reason/status')
      .setRequired(false)
  );

export async function execute(interaction) {
  const reason = interaction.options.getString('status') || 'AFK';
  const userId = interaction.user.id;

  afkUsers.set(userId, {
    reason,
    timestamp: Date.now()
  });

  const embed = new EmbedBuilder()
    .setColor('#57f287') // Green checkmark embed color
    .setDescription(`✅ ${interaction.user}: You're now AFK with the status: **${reason}**`);

  await interaction.reply({ embeds: [embed] });
}

export async function executePrefix(message, args) {
  const reason = args.join(' ') || 'AFK';
  const userId = message.author.id;

  afkUsers.set(userId, {
    reason,
    timestamp: Date.now()
  });

  const embed = new EmbedBuilder()
    .setColor('#57f287')
    .setDescription(`✅ ${message.author}: You're now AFK with the status: **${reason}**`);

  return message.reply({ embeds: [embed] });
}
