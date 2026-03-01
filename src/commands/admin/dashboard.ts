import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from 'discord.js';
import { Colors } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Get the link to the Doom Wen Dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {

    const embed = new EmbedBuilder()
        .setTitle('Doom Wen Dashboard')
        .setDescription('Configure your ticket system, streamline commissions, and manage bot settings all in one place.\n\nClick the button below to access the secure dashboard.')
        .setColor(Colors.ACCENT)
        .setThumbnail('https://cdn.discordapp.com/app-icons/1324328214152548434/26c2e2646c24388837130f40d7c046e7.png?size=256') // Using a placeholder or potentially the bot's icon if available via interaction.client.user
        .addFields(
            { name: '✨ Features', value: '• Ticket Management\n• Category Configuration\n• Commission Tracking\n• Real-time Updates', inline: false }
        )
        .setFooter({ text: 'Doom Wen • Configuration Panel' })
        .setTimestamp();

    // If we can get the client user explicitly
    if (interaction.client.user?.displayAvatarURL()) {
        embed.setThumbnail(interaction.client.user.displayAvatarURL());
    }

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Open Dashboard')
                .setStyle(ButtonStyle.Link)
                .setURL('https://doomwen-bot-dashboard.vercel.app/')
                .setEmoji('🛠️')
        );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}
