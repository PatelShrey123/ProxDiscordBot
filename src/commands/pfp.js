import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { convertEmbed } from '../utils/fontHelper.js';

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
  
  const pngUrl = targetUser.displayAvatarURL({ extension: 'png', size: 4096 });
  const jpgUrl = targetUser.displayAvatarURL({ extension: 'jpg', size: 4096 });
  const webpUrl = targetUser.displayAvatarURL({ extension: 'webp', size: 4096 });
  
  const isAnimated = targetUser.avatar && targetUser.avatar.startsWith('a_');
  const gifUrl = isAnimated ? targetUser.displayAvatarURL({ extension: 'gif', size: 4096 }) : null;

  let links = `[PNG](${pngUrl}) | [JPG](${jpgUrl}) | [WEBP](${webpUrl})`;
  if (gifUrl) {
    links += ` | [GIF](${gifUrl})`;
  }

  const embed = new EmbedBuilder()
    .setColor('#10b981')
    .setTitle(`👤 ${targetUser.username}'s Profile Picture`)
    .setDescription(`🔗 **Download:** ${links}`)
    .setImage(targetUser.displayAvatarURL({ size: 4096 }))
    .setFooter({ text: `Requested by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.reply({ embeds: [convertEmbed(embed)] });
}

export async function executePrefix(message, args) {
  let targetUser = message.author;

  if (args.length > 0) {
    // 1. Try mention
    const mentioned = message.mentions.users.first();
    if (mentioned) {
      targetUser = mentioned;
    } else {
      // 2. Try ID
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

  const pngUrl = targetUser.displayAvatarURL({ extension: 'png', size: 4096 });
  const jpgUrl = targetUser.displayAvatarURL({ extension: 'jpg', size: 4096 });
  const webpUrl = targetUser.displayAvatarURL({ extension: 'webp', size: 4096 });
  
  const isAnimated = targetUser.avatar && targetUser.avatar.startsWith('a_');
  const gifUrl = isAnimated ? targetUser.displayAvatarURL({ extension: 'gif', size: 4096 }) : null;

  let links = `[PNG](${pngUrl}) | [JPG](${jpgUrl}) | [WEBP](${webpUrl})`;
  if (gifUrl) {
    links += ` | [GIF](${gifUrl})`;
  }

  const embed = new EmbedBuilder()
    .setColor('#10b981')
    .setTitle(`👤 ${targetUser.username}'s Profile Picture`)
    .setDescription(`🔗 **Download:** ${links}`)
    .setImage(targetUser.displayAvatarURL({ size: 4096 }))
    .setFooter({ text: `Requested by ${message.author.username}` })
    .setTimestamp();

  await message.reply({ embeds: [convertEmbed(embed)] });
}
