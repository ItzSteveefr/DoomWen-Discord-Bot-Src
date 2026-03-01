/**
 * Simple in-memory cache with TTL support
 * Used for category and panel lookups to reduce database queries
 * 
 * @performance This cache reduces DB queries during ticket creation
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class SimpleCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private defaultTTL: number;
    private name: string;

    constructor(name: string, defaultTTLMs: number = 30000) {
        this.name = name;
        this.defaultTTL = defaultTTLMs;

        // Periodic cleanup every 60 seconds to prevent memory leaks
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Get a value from cache
     * Returns undefined if not found or expired
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    /**
     * Set a value in cache
     * @param key Cache key
     * @param value Value to store
     * @param ttlMs Optional TTL in milliseconds (uses default if not specified)
     */
    set(key: string, value: T, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTTL;
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl
        });
    }

    /**
     * Delete a specific key from cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries for a specific guild (pattern match)
     */
    invalidateGuild(guildId: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${guildId}:`)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            console.log(`[${this.name} Cache] Cleaned up ${removed} expired entries`);
        }
    }

    /**
     * Get cache stats for debugging
     */
    getStats(): { size: number; name: string } {
        return { size: this.cache.size, name: this.name };
    }
}

// Pre-configured caches for common use cases
// TTL of 30 seconds is a good balance between freshness and performance

import { ITicketCategory } from '../database/models/TicketCategory';
import { ITicketPanel } from '../database/models/TicketPanel';

/** Cache for ticket categories - 30 second TTL */
export const categoryCache = new SimpleCache<ITicketCategory>('Category', 30000);

/** Cache for ticket panels - 30 second TTL */
export const panelCache = new SimpleCache<ITicketPanel>('Panel', 30000);

/** Cache for categories by guild - 30 second TTL */
export const guildCategoriesCache = new SimpleCache<ITicketCategory[]>('GuildCategories', 30000);

/**
 * Get or fetch a category with caching
 * @param categoryId The category ID
 * @param fetchFn Function to fetch the category if not cached
 */
export async function getCachedCategory(
    categoryId: string,
    fetchFn: () => Promise<ITicketCategory | null>
): Promise<ITicketCategory | null> {
    const cached = categoryCache.get(categoryId);
    if (cached) return cached;

    const category = await fetchFn();
    if (category) {
        categoryCache.set(categoryId, category);
    }
    return category;
}

/**
 * Get or fetch a panel with caching
 * @param panelId The panel ID  
 * @param fetchFn Function to fetch the panel if not cached
 */
export async function getCachedPanel(
    panelId: string,
    fetchFn: () => Promise<ITicketPanel | null>
): Promise<ITicketPanel | null> {
    const cached = panelCache.get(panelId);
    if (cached) return cached;

    const panel = await fetchFn();
    if (panel) {
        panelCache.set(panelId, panel);
    }
    return panel;
}

export { SimpleCache };
