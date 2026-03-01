import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import { TicketModal, TicketCategory } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('remove-modal')
    .setDescription('Remove a ticket modal')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('modal-id')
            .setDescription('Modal ID to remove')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const modalId = interaction.options.getString('modal-id', true);

    // Find modal
    const modal = await TicketModal.findOne({
        guildId: interaction.guild.id,
        modalId
    });

    if (!modal) {
        await interaction.editReply({
            embeds: [errorEmbed(`Modal with ID "${modalId}" not found.`)]
        });
        return;
    }

    // Check if any categories reference this modal
    const categoriesUsingModal = await TicketCategory.countDocuments({
        guildId: interaction.guild.id,
        modalId
    });

    if (categoriesUsingModal > 0) {
        await interaction.editReply({
            embeds: [errorEmbed(
                `Cannot remove this modal - it is used by ${categoriesUsingModal} category/categories.\n` +
                `Update those categories to use a different modal first.`
            )]
        });
        return;
    }

    // Delete modal
    await TicketModal.findOneAndDelete({ modalId });

    await interaction.editReply({
        embeds: [successEmbed(`Modal "${modal.title}" (${modalId}) has been removed.`)]
    });
}
