import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique ID with optional prefix
 * Uses first 2 segments of UUID (12 chars) for better uniqueness
 */
export function generateId(prefix?: string): string {
    const segments = uuidv4().split('-');
    const id = segments[0] + segments[1]; // 8 + 4 = 12 chars
    return prefix ? `${prefix}_${id}` : id;
}

/**
 * Sanitize a string for use in channel names
 */
export function sanitizeChannelName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 90);
}

/**
 * Format a channel name for a ticket
 */
export function formatTicketChannelName(emoji: string, username: string): string {
    const sanitizedUsername = sanitizeChannelName(username);
    // Remove emoji modifiers and keep base emoji
    const cleanEmoji = emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
    return `${cleanEmoji}│${sanitizedUsername}`;
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Parse a deadline string into a Date
 */
export function parseDeadline(deadlineStr: string): Date | null {
    // Try to parse common formats
    const date = new Date(deadlineStr);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // Try relative formats like "3 days", "1 week"
    const relativeMatch = deadlineStr.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2].toLowerCase();
        const result = new Date();

        switch (unit) {
            case 'day':
            case 'days':
                result.setDate(result.getDate() + amount);
                break;
            case 'week':
            case 'weeks':
                result.setDate(result.getDate() + amount * 7);
                break;
            case 'month':
            case 'months':
                result.setMonth(result.getMonth() + amount);
                break;
        }

        return result;
    }

    return null;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
