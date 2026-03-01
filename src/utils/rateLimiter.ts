import { Collection } from 'discord.js';
import { Cooldown } from '../database/models';

interface CooldownEntry {
    expiresAt: number;
}

// In-memory cache for faster lookups (synced with DB)
const cooldownCache = new Collection<string, CooldownEntry>();

/**
 * Check if an action is on cooldown (async - uses database)
 * @returns Time remaining in ms, or 0 if not on cooldown
 */
export async function getCooldownRemainingAsync(
    type: string,
    guildId: string,
    targetId: string
): Promise<number> {
    const key = `${type}:${guildId}:${targetId}`;

    // Check cache first
    const cached = cooldownCache.get(key);
    if (cached) {
        const remaining = cached.expiresAt - Date.now();
        if (remaining <= 0) {
            cooldownCache.delete(key);
        } else {
            return remaining;
        }
    }

    // Check database
    const cooldown = await Cooldown.findOne({ type, guildId, targetId });
    if (!cooldown) return 0;

    const remaining = cooldown.expiresAt.getTime() - Date.now();
    if (remaining <= 0) {
        // Expired - MongoDB TTL will clean it up
        return 0;
    }

    // Update cache
    cooldownCache.set(key, { expiresAt: cooldown.expiresAt.getTime() });
    return remaining;
}

/**
 * Set a cooldown for an action (async - persists to database)
 * @param durationMs Duration in milliseconds
 */
export async function setCooldownAsync(
    type: string,
    guildId: string,
    targetId: string,
    durationMs: number
): Promise<void> {
    const key = `${type}:${guildId}:${targetId}`;
    const expiresAt = new Date(Date.now() + durationMs);

    // Update database (upsert)
    await Cooldown.findOneAndUpdate(
        { type, guildId, targetId },
        { expiresAt },
        { upsert: true }
    );

    // Update cache
    cooldownCache.set(key, { expiresAt: expiresAt.getTime() });
}

/**
 * Check if an action is on cooldown (async)
 */
export async function isOnCooldownAsync(
    type: string,
    guildId: string,
    targetId: string
): Promise<boolean> {
    return (await getCooldownRemainingAsync(type, guildId, targetId)) > 0;
}

/**
 * Format remaining time for display
 */
export function formatCooldown(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
}

/**
 * Clear all cooldowns (useful for testing)
 */
export async function clearAllCooldownsAsync(): Promise<void> {
    await Cooldown.deleteMany({});
    cooldownCache.clear();
}

// Clear memory cache periodically (DB has its own TTL cleanup)
setInterval(() => {
    const now = Date.now();
    cooldownCache.sweep(entry => entry.expiresAt < now);
}, 60 * 1000); // Every minute
