import { ButtonInteraction, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Ticket, TicketCategory, Commission } from '../../database/models';
import { TicketState, CommissionState } from '../../state';
import { TicketService, CommissionService } from '../../services';
import { parseButtonId, buildButtonId } from '../../types';
import { isOwner, canCloseTicket, hasAnyRole } from '../../utils/permissions';
import { errorEmbed, successEmbed, commissionStatusEmbed, infoEmbed } from '../../utils/embeds';
import { getCooldownRemainingAsync, setCooldownAsync, formatCooldown } from '../../utils/rateLimiter';
import { config } from '../../config/env';
import { buildCommissionDetailsModal } from './modalHandler';

const ticketService = new TicketService();
const commissionService = new CommissionService();

// Actions that require showing a modal (cannot defer first)
const MODAL_ACTIONS = ['start_commission'];

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const { action, params } = parseButtonId(interaction.customId);
    const ticketId = params.ticketId;

    // For modal actions, don't defer - handle separately
    if (MODAL_ACTIONS.includes(action)) {
        try {
            await handleStartCommissionModal(interaction, ticketId);
        } catch (error) {
            console.error('Modal action error:', error);
            // Try to respond if possible
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed('An error occurred')], flags: MessageFlags.Ephemeral }).catch(() => { });
            }
        }
        return;
    }

    // For other actions, defer immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        switch (action) {
            case 'ticket_panel':
                await handleTicketPanelClick(interaction, params);
                break;
            case 'close_ticket':
                await handleCloseTicket(interaction, ticketId);
                break;
            case 'ping_freelancers':
                await handlePingFreelancers(interaction, ticketId);
                break;
            case 'accept_quote':
                await handleAcceptQuote(interaction, ticketId);
                break;
            case 'reject_quote':
                await handleRejectQuote(interaction, ticketId);
                break;
            case 'end_commission':
                await handleEndCommission(interaction, ticketId);
                break;
            case 'confirm_completion':
                await handleConfirmCompletion(interaction, ticketId);
                break;
            default:
                await interaction.editReply({ embeds: [errorEmbed('Unknown button action')] });
        }
    } catch (error) {
        console.error('Button handler error:', error);
        await interaction.editReply({ embeds: [errorEmbed('An error occurred')] }).catch(() => { });
    }
}

/**
 * Handle Start Commission button - shows modal for price/deadline
 * CRITICAL: Show modal IMMEDIATELY to avoid interaction timeout (3s limit)
 * All validation is deferred to the modal submission handler
 */
async function handleStartCommissionModal(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    // Show the commission details modal IMMEDIATELY
    // All validation will happen when the modal is submitted
    // This prevents the 3-second interaction timeout
    const modal = buildCommissionDetailsModal(ticketId);
    await interaction.showModal(modal);
}

async function handleTicketPanelClick(
    interaction: ButtonInteraction,
    params: Record<string, string>
): Promise<void> {
    // This just opens the category selection - handled by select menu
    await interaction.editReply({
        content: 'Please select a category from the dropdown menu above.'
    });
}

async function handleCloseTicket(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Get ticket
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
        await interaction.editReply({ embeds: [errorEmbed('Ticket not found')] });
        return;
    }

    // Get member
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Check if user can close
    const { allowed, reason } = await canCloseTicket(member, ticketId, ticket.categoryId);
    if (!allowed) {
        await interaction.editReply({ embeds: [errorEmbed(reason || 'Cannot close ticket')] });
        return;
    }

    // Close the ticket
    const result = await ticketService.closeTicket(ticket, interaction.user.id, interaction.guild);

    if (!result.success) {
        await interaction.editReply({ embeds: [errorEmbed(result.error || 'Failed to close ticket')] });
        return;
    }

    await interaction.editReply({ embeds: [successEmbed('Ticket closed. Transcript has been generated.')] });
}

async function handlePingFreelancers(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Get ticket and verify it's a commission ticket
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
        await interaction.editReply({ embeds: [errorEmbed('Ticket not found')] });
        return;
    }

    // Verify this is a commission ticket
    if (!ticket.isCommission) {
        await interaction.editReply({ embeds: [errorEmbed('This is not a commission ticket')] });
        return;
    }

    // Only ticket creator or staff can ping
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const category = await TicketCategory.findOne({ categoryId: ticket.categoryId });

    if (!category) {
        await interaction.editReply({ embeds: [errorEmbed('Category not found')] });
        return;
    }

    const isStaff = hasAnyRole(member, [...category.freelancerRoleIds, ...category.adminRoleIds]);
    const isCreator = ticket.userId === interaction.user.id;

    if (!isCreator && !isStaff && !isOwner(interaction.user.id)) {
        await interaction.editReply({ embeds: [errorEmbed('Only the ticket creator or staff can ping freelancers')] });
        return;
    }

    // Check cooldown (12 hours) - uses persistent storage
    const remaining = await getCooldownRemainingAsync('freelancer_ping', ticket.guildId, ticketId);
    if (remaining > 0) {
        await interaction.editReply({
            embeds: [errorEmbed(`Freelancer ping is on cooldown. Try again in ${formatCooldown(remaining)}`)]
        });
        return;
    }

    // Set cooldown (persisted to database)
    await setCooldownAsync('freelancer_ping', ticket.guildId, ticketId, config.freelancerPingCooldown);

    // Update commission ping timestamp
    await commissionService.updatePingTimestamp(ticketId);

    // Build mention string
    const mentions = category.freelancerRoleIds.map(roleId => `<@&${roleId}>`).join(' ');

    // Send ping in channel
    const channel = interaction.channel as TextChannel;
    await channel.send({
        content: `🔔 **Freelancer Ping** ${mentions}\n\nA customer is waiting for assistance in this ticket.`
    });

    await interaction.editReply({ embeds: [successEmbed('Freelancers have been pinged!')] });
}

// NOTE: handleStartCommission was removed - commission start now uses modal flow via handleStartCommissionModal

async function handleEndCommission(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // End commission (service verifies permissions)
    const result = await commissionService.endCommission(ticketId, interaction.user.id);

    if (!result.success) {
        await interaction.editReply({ embeds: [errorEmbed(result.error || 'Failed to end commission')] });
        return;
    }

    // Get commission for customer ID
    const commission = await commissionService.getCommissionByTicket(ticketId);

    // Send confirmation request to channel
    const channel = interaction.channel as TextChannel;

    const confirmRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('confirm_completion', { ticketId }))
                .setLabel('Confirm Completion')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

    await channel.send({
        content: `<@${commission?.customerId}> - The freelancer has marked this commission as complete.`,
        embeds: [infoEmbed(
            '📋 Commission Completion',
            'Please confirm that the work has been completed to your satisfaction.\n\n' +
            '**Click "Confirm Completion" to close this ticket.**'
        )],
        components: [confirmRow]
    });

    await interaction.editReply({
        embeds: [successEmbed('Completion request sent. Waiting for customer confirmation.')]
    });
}

async function handleConfirmCompletion(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Confirm completion (service verifies permissions)
    const result = await commissionService.confirmCompletion(ticketId, interaction.user.id);

    if (!result.success) {
        await interaction.editReply({ embeds: [errorEmbed(result.error || 'Failed to confirm')] });
        return;
    }

    // Get ticket
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
        await interaction.editReply({ embeds: [errorEmbed('Ticket not found')] });
        return;
    }

    // Close the ticket
    const closeResult = await ticketService.closeTicket(ticket, interaction.user.id, interaction.guild);

    if (!closeResult.success) {
        await interaction.editReply({ embeds: [errorEmbed('Commission confirmed but failed to close ticket')] });
        return;
    }

    await interaction.editReply({
        embeds: [successEmbed('Commission completed! Thank you. Transcript has been sent.')]
    });
}

/**
 * Handle Accept Quote button - customer accepts the freelancer's quote
 */
async function handleAcceptQuote(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Get ticket to verify customer
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
        await interaction.editReply({ embeds: [errorEmbed('Ticket not found')] });
        return;
    }

    if (!ticket.isCommission) {
        await interaction.editReply({ embeds: [errorEmbed('This is not a commission ticket')] });
        return;
    }

    // Accept the quote (service verifies customer permission)
    const result = await commissionService.acceptQuote(ticketId, interaction.user.id);

    if (!result.success) {
        await interaction.editReply({ embeds: [errorEmbed(result.error || 'Failed to accept quote')] });
        return;
    }

    // Build updated dashboard
    const commission = result.commission!;
    const dashboardEmbed = commissionService.buildDashboardEmbed(commission, ticket.userId);
    const dashboardButtons = commissionService.buildDashboardButtons(
        ticketId,
        CommissionState.ACTIVE,
        true
    );

    // Send commission started message to channel
    const channel = interaction.channel as TextChannel;
    await channel.send({
        content: `✅ **Quote accepted!** <@${commission.freelancerId}>, you may now begin work on this commission.`,
        embeds: [dashboardEmbed],
        components: dashboardButtons
    });

    await interaction.editReply({
        embeds: [successEmbed(
            `Quote accepted!\n\n` +
            `**Freelancer:** <@${commission.freelancerId}>\n` +
            `**Agreed Price:** ${commission.price}\n` +
            `**Deadline:** ${commission.deadline}`
        )]
    });
}

/**
 * Handle Reject Quote button - customer rejects the freelancer's quote
 */
async function handleRejectQuote(
    interaction: ButtonInteraction,
    ticketId: string
): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Get ticket to verify customer
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
        await interaction.editReply({ embeds: [errorEmbed('Ticket not found')] });
        return;
    }

    // Get commission to log who submitted the quote
    const commission = await commissionService.getCommissionByTicket(ticketId);
    const rejectedFreelancerId = commission?.quotedBy;

    // Reject the quote (service verifies customer permission)
    const result = await commissionService.rejectQuote(ticketId, interaction.user.id);

    if (!result.success) {
        await interaction.editReply({ embeds: [errorEmbed(result.error || 'Failed to reject quote')] });
        return;
    }

    // Build updated dashboard
    const updatedCommission = await commissionService.getCommissionByTicket(ticketId);
    const dashboardButtons = commissionService.buildDashboardButtons(
        ticketId,
        CommissionState.OPEN,
        false
    );

    // Send rejection notice to channel
    const channel = interaction.channel as TextChannel;
    await channel.send({
        content: `❌ The quote from <@${rejectedFreelancerId}> was rejected.\nThis commission is now **open** for other freelancers to submit quotes.`,
        components: dashboardButtons
    });

    await interaction.editReply({
        embeds: [successEmbed('Quote rejected. The commission is now open for other freelancers.')]
    });
}
