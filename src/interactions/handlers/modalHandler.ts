import { ModalSubmitInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel, MessageFlags } from 'discord.js';
import { TicketPanel, TicketCategory, TicketModal, Commission, Ticket } from '../../database/models';
import { TicketService, CommissionService } from '../../services';
import { errorEmbed, successEmbed, commissionStatusEmbed } from '../../utils/embeds';
import { FormResponse } from '../../types';
import { CommissionState } from '../../state';
import { hasAnyRole, isOwner } from '../../utils/permissions';

const ticketService = new TicketService();
const commissionService = new CommissionService();

export async function handleModalSubmitInteraction(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;

    try {
        if (customId.startsWith('ticket_modal')) {
            await handleTicketModalSubmit(interaction);
        } else if (customId.startsWith('commission_details')) {
            await handleCommissionDetailsSubmit(interaction);
        } else {
            await interaction.reply({
                embeds: [errorEmbed('Unknown modal')],
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Modal handler error:', error);
        await interaction.reply({
            embeds: [errorEmbed('An error occurred')],
            flags: MessageFlags.Ephemeral
        }).catch(() => { });
    }
}

async function handleTicketModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Parse custom ID: ticket_modal|categoryId|modalId|panelId
    const parts = interaction.customId.split('|');
    const categoryId = parts[1];
    const modalId = parts[2];
    const panelId = parts[3] || 'default'; // panelId is now passed through customId

    // Get modal config for question labels
    const ticketModal = await TicketModal.findOne({ modalId });
    if (!ticketModal) {
        await interaction.editReply({ embeds: [errorEmbed('Modal configuration not found')] });
        return;
    }

    // Extract form responses
    const formResponses: FormResponse[] = ticketModal.questions.map(question => ({
        questionId: question.id,
        question: question.label,
        answer: interaction.fields.getTextInputValue(question.id) || ''
    }));

    // Create the ticket
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const result = await ticketService.createTicket(
        interaction.guild,
        member,
        categoryId,
        panelId,
        formResponses
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

async function handleCommissionDetailsSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Parse custom ID: commission_details|ticketId
    const parts = interaction.customId.split('|');
    const ticketId = parts[1];

    // Get values from modal
    const price = interaction.fields.getTextInputValue('price');
    const deadline = interaction.fields.getTextInputValue('deadline');

    // === VALIDATION (moved from button handler for timing safety) ===

    // Get ticket to verify
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
        await interaction.editReply({ embeds: [errorEmbed('Ticket not found')] });
        return;
    }

    if (!ticket.isCommission) {
        await interaction.editReply({ embeds: [errorEmbed('This is not a commission ticket')] });
        return;
    }

    // Get category to check freelancer roles
    const category = await TicketCategory.findOne({ categoryId: ticket.categoryId });
    if (!category) {
        await interaction.editReply({ embeds: [errorEmbed('Category not found')] });
        return;
    }

    // Check if user is a freelancer for this category
    const guildMember = await interaction.guild.members.fetch(interaction.user.id);
    if (!hasAnyRole(guildMember, category.freelancerRoleIds) && !isOwner(interaction.user.id)) {
        await interaction.editReply({ embeds: [errorEmbed('You are not a freelancer for this category')] });
        return;
    }

    // Check if commission is still available
    const commission = await Commission.findOne({ ticketId });
    if (!commission) {
        await interaction.editReply({ embeds: [errorEmbed('Commission not found')] });
        return;
    }

    // Check if quote already exists
    if (commission.quotedBy) {
        await interaction.editReply({ embeds: [errorEmbed('A quote has already been submitted. The customer must accept or reject it first.')] });
        return;
    }

    if (commission.state !== CommissionState.OPEN) {
        await interaction.editReply({ embeds: [errorEmbed(`Commission is not open for quotes (current state: ${commission.state})`)] });
        return;
    }

    // === END VALIDATION ===

    // Submit the quote (does NOT start the commission yet)
    const result = await commissionService.submitQuote(
        ticketId,
        interaction.user.id,
        price,
        deadline
    );

    if (!result.success) {
        await interaction.editReply({ embeds: [errorEmbed(result.error || 'Could not submit quote')] });
        return;
    }

    // Build quote summary embed and approval buttons
    const quoteEmbed = commissionService.buildQuoteEmbed(interaction.user.id, price, deadline);
    const quoteButtons = commissionService.buildQuoteButtons(ticketId);

    // Send quote to channel for customer to approve
    const channel = interaction.channel;
    if (channel && 'send' in channel) {
        await (channel as TextChannel).send({
            content: `<@${ticket.userId}> - A freelancer has submitted a quote! Please review:`,
            embeds: [quoteEmbed],
            components: quoteButtons
        });
    }

    await interaction.editReply({
        embeds: [successEmbed(
            `Quote submitted successfully!\n\n` +
            `**Price:** ${price}\n` +
            `**Deadline:** ${deadline}\n\n` +
            `The customer must **accept** your quote before the commission begins.`
        )]
    });
}

/**
 * Build commission details modal
 */
export function buildCommissionDetailsModal(ticketId: string): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(`commission_details|${ticketId}`)
        .setTitle('Commission Details')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('price')
                    .setLabel('Price')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., $50, 5000 coins')
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('deadline')
                    .setLabel('Deadline')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 3 days, Jan 15, 2024')
                    .setRequired(true)
                    .setMaxLength(100)
            )
        );
}
