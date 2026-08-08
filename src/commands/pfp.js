import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('pfp')
  .setDescription("Get a user's profile picture / avatar")
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose profile picture you want to view')
      .setRequired(false)
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const avatarUrl = targetUser.displayAvatarURL({ size: 4096 });

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`${targetUser.username}'s Avatar`)
    .setImage(avatarUrl);

  await interaction.reply({ content: avatarUrl, embeds: [embed] });
}

export async function executePrefix(message, args) {
  let targetUser = message.author;

  if (args.length > 0) {
    const mentioned = message.mentions.users.first();
    if (mentioned) {
      targetUser = mentioned;
    } else {
      const userId = args[0].replace(/[^0-9]/g, '');
      if (userId) {
        try {
          targetUser = await message.client.users.fetch(userId);
        } catch (err) {
          return message.reply('❌ Could not find a user with that ID.');
        }
      }
    }
  }

  const avatarUrl = targetUser.displayAvatarURL({ size: 4096 });

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`${targetUser.username}'s Avatar`)
    .setImage(avatarUrl);

  await message.reply({ content: avatarUrl, embeds: [embed] });
}
