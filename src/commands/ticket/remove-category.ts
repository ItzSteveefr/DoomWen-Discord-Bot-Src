import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import { TicketCategory, TicketPanel } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('remove-category')
    .setDescription('Remove a ticket category')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Category name to remove')
            .setRequired(true)
            .setAutocomplete(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const name = interaction.options.getString('name', true);

    // Find category
    const category = await TicketCategory.findOne({
        guildId: interaction.guild.id,
        name
    });

    if (!category) {
        await interaction.editReply({
            embeds: [errorEmbed(`Category "${name}" not found.`)]
        });
        return;
    }

    // Check if any panels reference this category
    const panelsUsingCategory = await TicketPanel.countDocuments({
        guildId: interaction.guild.id,
        categoryIds: category.categoryId
    });

    if (panelsUsingCategory > 0) {
        await interaction.editReply({
            embeds: [errorEmbed(
                `Cannot remove this category - it is used by ${panelsUsingCategory} panel(s).\n` +
                `Remove the category from panels first.`
            )]
        });
        return;
    }

    // Delete category
    await TicketCategory.findOneAndDelete({ categoryId: category.categoryId });

    await interaction.editReply({
        embeds: [successEmbed(`Category "${name}" has been removed.`)]
    });
}
