import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { Commission, Ticket, TicketCategory } from '../database/models';
import { CommissionState, isCommissionBlocking, canTransitionCommission, canSubmitQuote } from '../state';
import { isOwner, hasAnyRole } from '../utils/permissions';
import { buildButtonId } from '../types';

// Colors for commission embeds
const COLORS = {
    OPEN: 0x808080,           // Gray - waiting for quote
    QUOTE_SUBMITTED: 0xf1c40f, // Yellow - awaiting approval
    ACTIVE: 0x3498db,         // Blue - in progress
    PENDING_COMPLETION: 0xe67e22, // Orange - awaiting confirmation
    COMPLETED: 0x2ecc71,      // Green - done
    CANCELLED: 0xe74c3c       // Red - cancelled
};

export class CommissionService {
    /**
     * Check if a ticket is a commission ticket
     */
    async isCommissionTicket(ticketId: string): Promise<boolean> {
        const ticket = await Ticket.findOne({ ticketId });
        return ticket?.isCommission === true;
    }

    /**
     * Submit a quote for a commission (freelancer action)
     * Sets state to QUOTE_SUBMITTED but does NOT start the commission
     */
    async submitQuote(
        ticketId: string,
        freelancerId: string,
        price: string,
        deadline: string
    ): Promise<{ success: boolean; error?: string }> {
        // Atomic update - only succeeds if commission is OPEN and has no pending quote
        const result = await Commission.findOneAndUpdate(
            {
                ticketId,
                state: CommissionState.OPEN,
                quotedBy: { $exists: false }
            },
            {
                $set: {
                    quotedPrice: price,
                    quotedDeadline: deadline,
                    quotedBy: freelancerId,
                    quotedAt: new Date(),
                    state: CommissionState.QUOTE_SUBMITTED
                }
            },
            { new: true }
        );

        if (!result) {
            // Check why it failed
            const existing = await Commission.findOne({ ticketId });
            if (existing?.quotedBy) {
                return { success: false, error: 'A quote has already been submitted for this commission' };
            }
            if (existing?.state !== CommissionState.OPEN) {
                return { success: false, error: `Commission is not open for quotes (current state: ${existing?.state})` };
            }
            return { success: false, error: 'Could not submit quote' };
        }

        return { success: true };
    }

    /**
     * Accept a quote (customer action)
     * Sets state to ACTIVE and assigns the freelancer
     */
    async acceptQuote(
        ticketId: string,
        customerId: string
    ): Promise<{ success: boolean; error?: string; commission?: typeof Commission.prototype }> {
        // Get commission first to validate
        const commission = await Commission.findOne({ ticketId });
        if (!commission) {
            return { success: false, error: 'Commission not found' };
        }

        // Validate customer (only customer can accept)
        if (!isOwner(customerId) && commission.customerId !== customerId) {
            return { success: false, error: 'Only the ticket owner can accept a quote' };
        }

        // Validate state
        if (commission.state !== CommissionState.QUOTE_SUBMITTED) {
            return { success: false, error: 'No quote pending approval' };
        }

        // Accept the quote - finalize price/deadline and set state to ACTIVE
        const result = await Commission.findOneAndUpdate(
            { ticketId, state: CommissionState.QUOTE_SUBMITTED },
            {
                $set: {
                    freelancerId: commission.quotedBy,
                    price: commission.quotedPrice,
                    deadline: commission.quotedDeadline,
                    state: CommissionState.ACTIVE,
                    startedAt: new Date()
                }
            },
            { new: true }
        );

        if (!result) {
            return { success: false, error: 'Failed to accept quote' };
        }

        return { success: true, commission: result };
    }

    /**
     * Reject a quote (customer action)
     * Resets state to OPEN and clears quote data
     */
    async rejectQuote(
        ticketId: string,
        customerId: string
    ): Promise<{ success: boolean; error?: string }> {
        const commission = await Commission.findOne({ ticketId });
        if (!commission) {
            return { success: false, error: 'Commission not found' };
        }

        // Validate customer
        if (!isOwner(customerId) && commission.customerId !== customerId) {
            return { success: false, error: 'Only the ticket owner can reject a quote' };
        }

        // Validate state
        if (commission.state !== CommissionState.QUOTE_SUBMITTED) {
            return { success: false, error: 'No quote pending to reject' };
        }

        // Reject and reset
        await Commission.findOneAndUpdate(
            { ticketId },
            {
                $set: { state: CommissionState.OPEN },
                $unset: { quotedPrice: 1, quotedDeadline: 1, quotedBy: 1, quotedAt: 1 }
            }
        );

        return { success: true };
    }

    /**
     * End a commission (freelancer triggers completion)
     */
    async endCommission(
        ticketId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        const commission = await Commission.findOne({ ticketId });
        if (!commission) {
            return { success: false, error: 'Commission not found' };
        }

        // Owner can always end, otherwise must be assigned freelancer
        if (!isOwner(userId) && commission.freelancerId !== userId) {
            return { success: false, error: 'Only the assigned freelancer can end this commission' };
        }

        // Check state transition
        if (!canTransitionCommission(commission.state as CommissionState, CommissionState.PENDING_COMPLETION)) {
            return { success: false, error: `Cannot end commission from state: ${commission.state}` };
        }

        await Commission.findOneAndUpdate(
            { ticketId },
            { state: CommissionState.PENDING_COMPLETION }
        );

        return { success: true };
    }

    /**
     * Customer confirms commission completion
     */
    async confirmCompletion(
        ticketId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        const commission = await Commission.findOne({ ticketId });
        if (!commission) {
            return { success: false, error: 'Commission not found' };
        }

        // Owner can always confirm, otherwise must be customer
        if (!isOwner(userId) && commission.customerId !== userId) {
            return { success: false, error: 'Only the customer can confirm completion' };
        }

        // Check state
        if (commission.state !== CommissionState.PENDING_COMPLETION) {
            return { success: false, error: 'Commission is not awaiting confirmation' };
        }

        await Commission.findOneAndUpdate(
            { ticketId },
            {
                state: CommissionState.COMPLETED,
                customerConfirmed: true,
                endedAt: new Date()
            }
        );

        return { success: true };
    }

    /**
     * Force cancel commission (owner only)
     */
    async forceCancel(
        ticketId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!isOwner(userId)) {
            return { success: false, error: 'Only the bot owner can force cancel commissions' };
        }

        const result = await Commission.findOneAndUpdate(
            { ticketId },
            { state: CommissionState.CANCELLED, endedAt: new Date() },
            { new: true }
        );

        if (!result) {
            return { success: false, error: 'Commission not found' };
        }

        return { success: true };
    }

    /**
     * Get commission by ticket ID
     */
    async getCommissionByTicket(ticketId: string): Promise<typeof Commission.prototype | null> {
        return Commission.findOne({ ticketId });
    }

    /**
     * Update freelancer ping timestamp
     */
    async updatePingTimestamp(ticketId: string): Promise<void> {
        await Commission.findOneAndUpdate(
            { ticketId },
            { lastFreelancerPing: new Date() }
        );
    }

    /**
     * Build quote summary embed for customer to approve/reject
     */
    buildQuoteEmbed(
        freelancerId: string,
        price: string,
        deadline: string
    ): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle('Quote Submitted')
            .setColor(COLORS.QUOTE_SUBMITTED)
            .setDescription(
                `A freelancer has submitted a quote for your commission.\n\n` +
                `**Freelancer:** <@${freelancerId}>\n` +
                `**Quoted Price:** ${price}\n` +
                `**Estimated Deadline:** ${deadline}\n\n` +
                `Please review and accept or reject this quote.`
            )
            .setTimestamp()
            .setFooter({ text: 'Quote Approval Required' });
    }

    /**
     * Build buttons for quote approval
     */
    buildQuoteButtons(ticketId: string): ActionRowBuilder<ButtonBuilder>[] {
        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('accept_quote', { ticketId }))
                .setLabel('Accept Quote')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('reject_quote', { ticketId }))
                .setLabel('Reject Quote')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        return [row];
    }

    /**
     * Build commission dashboard embed based on current state
     */
    buildDashboardEmbed(
        commission: typeof Commission.prototype,
        customerId: string
    ): EmbedBuilder {
        const state = commission.state as CommissionState;
        const color = COLORS[state] || COLORS.OPEN;

        const embed = new EmbedBuilder()
            .setTitle('Commission Dashboard')
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: `Commission ID: ${commission.commissionId}` });

        // Add customer field
        embed.addFields({ name: 'Customer', value: `<@${customerId}>`, inline: true });

        // Add state-specific content
        switch (state) {
            case CommissionState.OPEN:
                embed.setDescription('Waiting for a freelancer to submit a quote.');
                break;

            case CommissionState.QUOTE_SUBMITTED:
                embed.setDescription('A quote has been submitted and awaits customer approval.');
                embed.addFields(
                    { name: 'Quoted By', value: `<@${commission.quotedBy}>`, inline: true },
                    { name: 'Quoted Price', value: commission.quotedPrice || 'N/A', inline: true },
                    { name: 'Quoted Deadline', value: commission.quotedDeadline || 'N/A', inline: true }
                );
                break;

            case CommissionState.ACTIVE:
                embed.setDescription('Commission is in progress.');
                embed.addFields(
                    { name: 'Freelancer', value: `<@${commission.freelancerId}>`, inline: true },
                    { name: 'Price', value: commission.price || 'N/A', inline: true },
                    { name: 'Deadline', value: commission.deadline || 'N/A', inline: true }
                );
                break;

            case CommissionState.PENDING_COMPLETION:
                embed.setDescription('Freelancer has marked this as complete. Awaiting customer confirmation.');
                embed.addFields(
                    { name: 'Freelancer', value: `<@${commission.freelancerId}>`, inline: true },
                    { name: 'Price', value: commission.price || 'N/A', inline: true }
                );
                break;

            case CommissionState.COMPLETED:
                embed.setDescription('Commission completed successfully!');
                embed.addFields(
                    { name: 'Freelancer', value: `<@${commission.freelancerId}>`, inline: true },
                    { name: 'Final Price', value: commission.price || 'N/A', inline: true }
                );
                break;

            case CommissionState.CANCELLED:
                embed.setDescription('Commission was cancelled.');
                break;
        }

        embed.addFields({ name: 'Status', value: `\`${state}\``, inline: true });

        return embed;
    }

    /**
     * Build commission dashboard buttons based on current state
     */
    buildDashboardButtons(
        ticketId: string,
        state: CommissionState,
        hasFreelancer: boolean
    ): ActionRowBuilder<ButtonBuilder>[] {
        const row = new ActionRowBuilder<ButtonBuilder>();

        // Close button - disabled during active commission
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('close_ticket', { ticketId }))
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
                .setDisabled(isCommissionBlocking(state))
        );

        // Ping freelancers - only when OPEN
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('ping_freelancers', { ticketId }))
                .setLabel('Ping Freelancers')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(state !== CommissionState.OPEN)
        );

        // Start commission - only when OPEN
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('start_commission', { ticketId }))
                .setLabel('Submit Quote')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💰')
                .setDisabled(state !== CommissionState.OPEN)
        );

        // End commission - only when ACTIVE
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('end_commission', { ticketId }))
                .setLabel('Mark Complete')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
                .setDisabled(state !== CommissionState.ACTIVE)
        );

        // Confirm completion - only when PENDING_COMPLETION
        if (state === CommissionState.PENDING_COMPLETION || state === CommissionState.ACTIVE) {
            const row2 = new ActionRowBuilder<ButtonBuilder>();
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildButtonId('confirm_completion', { ticketId }))
                    .setLabel('Confirm Completion')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✔️')
                    .setDisabled(state !== CommissionState.PENDING_COMPLETION)
            );
            return [row, row2];
        }

        return [row];
    }
}
