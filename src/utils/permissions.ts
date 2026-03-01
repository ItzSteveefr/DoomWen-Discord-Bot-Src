import {
    GuildMember,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction
} from 'discord.js';
import { config } from '../config/env';
import { TicketCategory, Commission } from '../database/models';

/**
 * Check if user is the bot owner
 */
export function isOwner(userId: string): boolean {
    return userId === config.ownerId;
}

/**
 * Check if user has administrator permission
 */
export function isAdmin(member: GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Check if user has a specific role
 */
export function hasRole(member: GuildMember, roleId: string): boolean {
    return member.roles.cache.has(roleId);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(member: GuildMember, roleIds: string[]): boolean {
    return roleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Check if user is a freelancer for a specific category
 */
export async function isFreelancerForCategory(
    member: GuildMember,
    categoryId: string
): Promise<boolean> {
    const category = await TicketCategory.findOne({ categoryId });
    if (!category) return false;
    return hasAnyRole(member, category.freelancerRoleIds);
}

/**
 * Check if user is the assigned freelancer for a commission
 */
export async function isAssignedFreelancer(
    userId: string,
    ticketId: string
): Promise<boolean> {
    const commission = await Commission.findOne({ ticketId });
    if (!commission) return false;
    return commission.freelancerId === userId;
}

/**
 * Check if user can manage a ticket
 * - Owner can always manage
 * - Admins can manage
 * - Freelancers with assigned role can manage
 */
export async function canManageTicket(
    member: GuildMember,
    categoryId: string
): Promise<boolean> {
    if (isOwner(member.id)) return true;
    if (isAdmin(member)) return true;

    const category = await TicketCategory.findOne({ categoryId });
    if (!category) return false;

    // Check admin roles
    if (hasAnyRole(member, category.adminRoleIds)) return true;

    // Check freelancer roles
    if (hasAnyRole(member, category.freelancerRoleIds)) return true;

    return false;
}

/**
 * Permission denied response helper
 */
export async function permissionDenied(
    interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
    reason = 'You do not have permission to perform this action.'
): Promise<void> {
    await interaction.reply({
        content: `❌ ${reason}`,
        ephemeral: true
    });
}

/**
 * Check if user can close a ticket
 * For commission tickets, additional checks apply
 */
export async function canCloseTicket(
    member: GuildMember,
    ticketId: string,
    categoryId: string
): Promise<{ allowed: boolean; reason?: string }> {
    // Owner can always close
    if (isOwner(member.id)) {
        return { allowed: true };
    }

    // Check if user can manage the ticket
    const canManage = await canManageTicket(member, categoryId);

    // Check if this is a commission ticket
    const commission = await Commission.findOne({ ticketId });

    if (commission) {
        // Commission tickets have special rules
        const { CommissionState } = await import('../state');

        if (commission.state === CommissionState.ACTIVE) {
            return {
                allowed: false,
                reason: 'Cannot close ticket while commission is active. End the commission first.'
            };
        }

        if (commission.state === CommissionState.PENDING_COMPLETION) {
            return {
                allowed: false,
                reason: 'Waiting for customer confirmation before closing.'
            };
        }

        if (commission.state === CommissionState.OPEN || commission.state === CommissionState.QUOTE_SUBMITTED) {
            // Only staff can close open or quote-pending commissions
            if (!canManage) {
                return {
                    allowed: false,
                    reason: 'Only staff can close this ticket.'
                };
            }
        }
    }

    return { allowed: canManage };
}
