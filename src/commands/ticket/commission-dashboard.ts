import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    TextChannel,
    MessageFlags
} from 'discord.js';
import { Ticket, Commission, TicketCategory } from '../../database/models';
import { CommissionService } from '../../services';
import { CommissionState } from '../../state';
import { errorEmbed } from '../../utils/embeds';
import { hasAnyRole, isOwner } from '../../utils/permissions';

const commissionService = new CommissionService();

export const data = new SlashCommandBuilder()
    .setName('commission-dashboard')
    .setDescription('Re-send the commission dashboard for this ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

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

    // Verify this is a commission ticket
    if (!ticket.isCommission) {
        await interaction.editReply({
            embeds: [errorEmbed('This is not a commission ticket.')]
        });
        return;
    }

    // Get commission
    const commission = await Commission.findOne({ ticketId: ticket.ticketId });
    if (!commission) {
        await interaction.editReply({
            embeds: [errorEmbed('Commission data not found.')]
        });
        return;
    }

    // Get member
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Get category to check roles
    const category = await TicketCategory.findOne({ categoryId: ticket.categoryId });

    // Permission check: Admin, freelancer, ticket owner, or bot owner
    let canView = false;

    if (isOwner(interaction.user.id)) {
        canView = true;
    } else if (ticket.userId === interaction.user.id) {
        // Ticket owner
        canView = true;
    } else if (commission.freelancerId === interaction.user.id) {
        // Assigned freelancer
        canView = true;
    } else if (category && hasAnyRole(member, [...category.adminRoleIds, ...category.freelancerRoleIds])) {
        // Admin or freelancer role
        canView = true;
    }

    if (!canView) {
        await interaction.editReply({
            embeds: [errorEmbed('You do not have permission to view the commission dashboard.')]
        });
        return;
    }

    // Build and send dashboard
    const state = commission.state as CommissionState;
    const hasFreelancer = !!commission.freelancerId;

    const dashboardEmbed = commissionService.buildDashboardEmbed(commission, ticket.userId);
    const dashboardButtons = commissionService.buildDashboardButtons(ticket.ticketId, state, hasFreelancer);

    const channel = interaction.channel as TextChannel;
    await channel.send({
        embeds: [dashboardEmbed],
        components: dashboardButtons
    });

    await interaction.editReply({
        content: '✅ Commission dashboard sent.'
    });
}
