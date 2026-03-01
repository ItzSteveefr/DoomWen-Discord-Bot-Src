import {
    Guild,
    TextChannel,
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
} from 'discord.js';
import { Ticket, TicketCategory, TicketPanel, Commission } from '../database/models';
import { TicketState, CommissionState } from '../state';
import { FormResponse, buildButtonId } from '../types';
import { createTicketInfoEmbed } from '../utils/embeds';
import { generateId, formatTicketChannelName } from '../utils/validation';
import { TranscriptService } from './transcriptService';
import { getCachedCategory, getCachedPanel } from '../utils/cache';

export class TicketService {
    private transcriptService: TranscriptService;

    constructor() {
        this.transcriptService = new TranscriptService();
    }

    /**
     * Check if user already has an open ticket in this category
     */
    async hasOpenTicket(guildId: string, userId: string, categoryId: string): Promise<boolean> {
        const count = await Ticket.countDocuments({
            guildId,
            userId,
            categoryId,
            state: { $ne: TicketState.CLOSED }
        });
        return count > 0;
    }

    /**
     * Create a new ticket channel and database entry
     * @performance Uses caching for category and panel lookups
     */
    async createTicket(
        guild: Guild,
        member: GuildMember,
        categoryId: string,
        panelId: string,
        formResponses: FormResponse[]
    ): Promise<{ success: boolean; channelId?: string; error?: string }> {
        try {
            // Get category configuration with caching
            const category = await getCachedCategory(categoryId, async () => {
                return await TicketCategory.findOne({ categoryId });
            });
            if (!category) {
                return { success: false, error: 'Category not found' };
            }

            // Get panel with caching to determine if this is a commission ticket
            const panel = await getCachedPanel(panelId, async () => {
                return await TicketPanel.findOne({ panelId });
            });
            if (!panel) {
                return { success: false, error: 'Panel not found' };
            }

            // Check for existing ticket
            if (await this.hasOpenTicket(guild.id, member.id, categoryId)) {
                return { success: false, error: 'You already have an open ticket in this category' };
            }

            // Get Discord category
            const discordCategory = await guild.channels.fetch(category.discordCategoryId);
            if (!discordCategory || discordCategory.type !== ChannelType.GuildCategory) {
                return { success: false, error: 'Discord category not found' };
            }

            // Build permission overwrites
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                    ],
                },
            ];

            // Add freelancer/admin roles
            for (const roleId of [...category.freelancerRoleIds, ...category.adminRoleIds]) {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                    ],
                });
            }

            // Create ticket channel
            const channelName = formatTicketChannelName(category.emoji, member.user.username);
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.discordCategoryId,
                permissionOverwrites,
            });

            // Generate ticket ID
            const ticketId = generateId('ticket');

            // Determine if this is a commission ticket based on category flag
            const isCommissionTicket = category.isCommissionCategory;

            // Create ticket in database with isCommission flag
            const ticket = await Ticket.create({
                ticketId,
                guildId: guild.id,
                channelId: channel.id,
                userId: member.id,
                categoryId,
                panelId,
                state: TicketState.OPEN,
                isCommission: isCommissionTicket,
                formResponses,
            });

            // Create commission record if this is a commission ticket
            if (isCommissionTicket) {
                await Commission.create({
                    commissionId: generateId('comm'),
                    ticketId,
                    guildId: guild.id,
                    state: CommissionState.OPEN,
                    customerId: member.id,
                });
            }

            // Build action buttons (commission buttons only if isCommissionTicket)
            const buttons = this.buildTicketButtons(isCommissionTicket, ticketId);

            // Send initial message with user's avatar for personalization
            const userAvatarUrl = member.user.displayAvatarURL({ size: 128 });
            const infoEmbed = createTicketInfoEmbed(member.id, category.name, formResponses, userAvatarUrl);

            // Build mention string for freelancers/admins
            const mentions = [...category.freelancerRoleIds, ...category.adminRoleIds]
                .map(roleId => `<@&${roleId}>`)
                .join(' ');

            await channel.send({
                content: `<@${member.id}> ${mentions}`,
                embeds: [infoEmbed],
                components: buttons,
            });

            return { success: true, channelId: channel.id };
        } catch (error) {
            console.error('Error creating ticket:', error);
            return { success: false, error: 'Failed to create ticket channel' };
        }
    }

    /**
     * Build action buttons for a ticket
     */
    private buildTicketButtons(isCommission: boolean, ticketId: string): ActionRowBuilder<ButtonBuilder>[] {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];

        const row1 = new ActionRowBuilder<ButtonBuilder>();

        // Close button (always present)
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId('close_ticket', { ticketId }))
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );

        if (isCommission) {
            // Ping freelancers button
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildButtonId('ping_freelancers', { ticketId }))
                    .setLabel('Ping Freelancers')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔔')
            );

            // Start commission button
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildButtonId('start_commission', { ticketId }))
                    .setLabel('Start Commission')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️')
            );

            // End commission button
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildButtonId('end_commission', { ticketId }))
                    .setLabel('End Commission')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✅')
                    .setDisabled(true) // Disabled until commission is started
            );
        }

        rows.push(row1);
        return rows;
    }

    /**
     * Close a ticket
     */
    async closeTicket(
        ticket: typeof Ticket.prototype,
        closedBy: string,
        guild: Guild
    ): Promise<{ success: boolean; transcriptUrl?: string; error?: string }> {
        try {
            // Get channel
            const channel = await guild.channels.fetch(ticket.channelId);
            if (!channel || !(channel instanceof TextChannel)) {
                // Channel already deleted, just update DB
                await Ticket.findOneAndUpdate(
                    { ticketId: ticket.ticketId },
                    {
                        state: TicketState.CLOSED,
                        closedAt: new Date(),
                        closedBy
                    }
                );
                return { success: true };
            }

            // Generate transcript
            const transcriptResult = await this.transcriptService.generateAndUpload(
                channel,
                ticket.ticketId
            );

            // Update ticket
            await Ticket.findOneAndUpdate(
                { ticketId: ticket.ticketId },
                {
                    state: TicketState.CLOSED,
                    closedAt: new Date(),
                    closedBy,
                    transcriptUrl: transcriptResult.url
                }
            );

            // Try to DM user the transcript
            try {
                const user = await guild.client.users.fetch(ticket.userId);
                const { transcriptEmbed } = await import('../utils/embeds');
                await user.send({
                    embeds: [transcriptEmbed(channel.name, transcriptResult.url)]
                });
            } catch (dmError) {
                // User may have DMs disabled
                console.log('Could not DM transcript to user:', dmError);
            }

            // Delete channel
            await channel.delete('Ticket closed');

            return { success: true, transcriptUrl: transcriptResult.url };
        } catch (error) {
            console.error('Error closing ticket:', error);
            return { success: false, error: 'Failed to close ticket' };
        }
    }

    /**
     * Get ticket by channel ID
     */
    async getTicketByChannel(channelId: string): Promise<typeof Ticket.prototype | null> {
        return Ticket.findOne({ channelId });
    }

    /**
     * Get ticket by ticket ID
     */
    async getTicketById(ticketId: string): Promise<typeof Ticket.prototype | null> {
        return Ticket.findOne({ ticketId });
    }
}
