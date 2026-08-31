import { SlashCommandBuilder } from 'discord.js';

const BOT_OWNER_ID = '728104078428733452';

export const data = new SlashCommandBuilder()
  .setName('botavatar')
  .setDescription('Change the bot\'s global profile picture (Bot Owner only)')
  .addAttachmentOption(option =>
    option.setName('image')
      .setDescription('Upload the new bot logo/avatar')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('url')
      .setDescription('The URL of the new bot logo/avatar')
      .setRequired(false)
  );

export async function execute(interaction) {
  if (interaction.user.id !== BOT_OWNER_ID) {
    return interaction.reply({
      content: '❌ Only the Bot Owner can change the bot\'s global logo/avatar!',
      flags: 64 // ephemeral
    });
  }

  const attachment = interaction.options.getAttachment('image');
  const urlOption = interaction.options.getString('url');
  const avatarUrl = attachment ? attachment.url : urlOption;

  if (!avatarUrl) {
    return interaction.reply({
      content: '❌ Please upload an image or provide a valid image URL!',
      flags: 64
    });
  }

  await interaction.deferReply();

  try {
    await interaction.client.user.setAvatar(avatarUrl);
    return interaction.editReply('✅ Successfully updated my global logo/avatar!');
  } catch (err) {
    console.error('Error setting bot avatar:', err);
    return interaction.editReply(`⚠️ Failed to change avatar: ${err.message}`);
  }
}

export async function executePrefix(message, args) {
  if (message.author.id !== BOT_OWNER_ID) {
    return; // Silently ignore if not bot owner
  }

  const attachment = message.attachments.first();
  const avatarUrl = attachment ? attachment.url : args[0];

  if (!avatarUrl) {
    return message.reply('❌ Please attach an image or provide a valid image URL!');
  }

  try {
    await message.client.user.setAvatar(avatarUrl);
    return message.reply('✅ Successfully updated my global logo/avatar!');
  } catch (err) {
    console.error('Error setting bot avatar in prefix command:', err);
    return message.reply(`⚠️ Failed to change avatar: ${err.message}`);
  }
}
