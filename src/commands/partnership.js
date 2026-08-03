import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('partnership')
  .setDescription('Print the PROx partnership advertisement message');

const partnerMessage = `**PROx | Protox**

*Beware of The Banana King, Dont mess with him in Protox.io*

➤ Fun and Competitive clan
➤ Compete in tournaments and events.
➤ Participate in daily giveaways.
➤ Clan rewards to top 3 grinders.
➤ Chat with the PROx Protox.io community!

**Join PROx now!!**

**Server Link:** [PROx Discord Server](https://discord.gg/YtmyGfaqwR)`;

export async function execute(interaction) {
  await interaction.reply({ content: partnerMessage });
}

export async function executePrefix(message, args) {
  return message.reply({ content: partnerMessage });
}
