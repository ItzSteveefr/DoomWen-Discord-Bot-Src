import { StringSelectMenuInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { TicketPanel, TicketCategory, TicketModal } from '../../database/models';
import { errorEmbed } from '../../utils/embeds';
import { TicketService } from '../../services';
import { getCachedCategory } from '../../utils/cache';

const ticketService = new TicketService();

export async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    const customId = interaction.customId;

    try {
        if (customId.startsWith('category_select')) {
            await handleCategorySelect(interaction);
        } else {
            await interaction.reply({
                embeds: [errorEmbed('Unknown select menu')],
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Select menu handler error:', error);
        await interaction.reply({
            embeds: [errorEmbed('An error occurred')],
            flags: MessageFlags.Ephemeral
        }).catch(() => { });
    }
}

async function handleCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const categoryId = interaction.values[0];

    if (!interaction.guild) {
        await interaction.reply({
            embeds: [errorEmbed('Invalid context')],
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Extract panel ID upfront
    const panelId = interaction.customId.split('|')[1];

    // OPTIMIZATION: Fetch category and check open ticket in parallel
    const [category, hasTicket] = await Promise.all([
        getCachedCategory(categoryId, async () => {
            const doc = await TicketCategory.findOne({ categoryId });
            return doc;
        }),
        ticketService.hasOpenTicket(
            interaction.guild.id,
            interaction.user.id,
            categoryId
        )
    ]);

    if (!category) {
        await interaction.reply({
            embeds: [errorEmbed('Category not found')],
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (hasTicket) {
        await interaction.reply({
            embeds: [errorEmbed('You already have an open ticket in this category.')],
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Check if category has a modal - show it immediately if so
    if (category.modalId) {
        const ticketModal = await TicketModal.findOne({ modalId: category.modalId });

        if (ticketModal) {
            // Build and show modal - pass panelId for proper tracking
            const modal = buildModal(ticketModal, categoryId, panelId || 'default');
            await interaction.showModal(modal);
            return;
        }
    }

    // No modal - create ticket directly
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await ticketService.createTicket(
        interaction.guild,
        await interaction.guild.members.fetch(interaction.user.id),
        categoryId,
        panelId || 'default',
        []
    );

    if (!result.success) {
        await interaction.editReply({
            embeds: [errorEmbed(result.error || 'Failed to create ticket')]
        });
        return;
    }

    await interaction.editReply({
        content: `✅ Ticket created! <#${result.channelId}>`
    });
}

function buildModal(ticketModal: typeof TicketModal.prototype, categoryId: string, panelId: string): ModalBuilder {
    // Format: ticket_modal|categoryId|modalId|panelId
    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal|${categoryId}|${ticketModal.modalId}|${panelId}`)
        .setTitle(ticketModal.title);

    // Add text inputs from modal config
    for (const question of ticketModal.questions.slice(0, 5)) { // Discord limit: 5 components
        const textInput = new TextInputBuilder()
            .setCustomId(question.id)
            .setLabel(question.label)
            .setStyle(question.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(question.required);

        if (question.placeholder) {
            textInput.setPlaceholder(question.placeholder);
        }
        if (question.minLength) {
            textInput.setMinLength(question.minLength);
        }
        if (question.maxLength) {
            textInput.setMaxLength(question.maxLength);
        }

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
        modal.addComponents(row);
    }

    return modal;
}
