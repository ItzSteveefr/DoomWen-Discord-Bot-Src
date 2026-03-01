import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import { Ticket, Commission, TicketCategory } from '../../database/models';
import { TicketService } from '../../services';
import { CommissionState, isCommissionBlocking } from '../../state';
import { errorEmbed, successEmbed } from '../../utils/embeds';
import { hasAnyRole, isOwner } from '../../utils/permissions';

const ticketService = new TicketService();

export const data = new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Close the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    // Find ticket for this channel
    const ticket = await Ticket.findOne({
        guildId: interaction.guild.id,
        channelId: interaction.channel.id
    });

    if (!ticket) {
        await interaction.editReply({
            embeds: [errorEmbed('This command can only be used inside a ticket channel.')]
        });
        return;
    }

    // Get member
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Get category to check admin roles
    const category = await TicketCategory.findOne({ categoryId: ticket.categoryId });
    if (!category) {
        await interaction.editReply({ embeds: [errorEmbed('Category not found')] });
        return;
    }

    // Permission check: Admin role or owner
    const isAdmin = hasAnyRole(member, category.adminRoleIds) || isOwner(interaction.user.id);
    if (!isAdmin) {
        await interaction.editReply({
            embeds: [errorEmbed('You do not have permission to close tickets.')]
        });
        return;
    }

    // Commission ticket check
    if (ticket.isCommission) {
        const commission = await Commission.findOne({ ticketId: ticket.ticketId });
        if (commission && isCommissionBlocking(commission.state as CommissionState)) {
            // Only allow close if COMPLETED or CANCELLED
            if (commission.state !== CommissionState.COMPLETED && commission.state !== CommissionState.CANCELLED) {
                await interaction.editReply({
                    embeds: [errorEmbed(
                        `Cannot close this ticket - the commission is not complete.\n\n` +
                        `**Current State:** \`${commission.state}\`\n\n` +
                        `Commission tickets can only be closed when the commission is \`COMPLETED\` or \`CANCELLED\`.`
                    )]
                });
                return;
            }
        }
    }

    // Close the ticket
    const result = await ticketService.closeTicket(ticket, interaction.user.id, interaction.guild);

    if (!result.success) {
        await interaction.editReply({
            embeds: [errorEmbed(result.error || 'Failed to close ticket')]
        });
        return;
    }

    await interaction.editReply({
        embeds: [successEmbed('Ticket closed. Transcript has been generated.')]
    });
}
