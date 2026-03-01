import { Client, Events, Message, EmbedBuilder, PermissionFlagsBits, Collection, TextChannel } from 'discord.js';
import { ServerConfig, KeywordReply } from '../database/models';

// Counting embed colors
const COUNTING_COLORS = {
    SUCCESS: 0x2ecc71,   // Green
    ERROR: 0xe74c3c,     // Red
    WARNING: 0xf1c40f,   // Yellow
    INFO: 0x3498db       // Blue
};

// Counting channel cache: guildId -> { channelId, expiresAt }
interface CachedCountingChannel {
    channelId: string | null;
    expiresAt: number;
}
const countingChannelCache = new Collection<string, CachedCountingChannel>();
const COUNTING_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Keyword cache: guildId -> { keywords, expiresAt }
interface CachedKeywords {
    keywords: Array<{ keyword: string; response: string }>;
    expiresAt: number;
}
const keywordCache = new Collection<string, CachedKeywords>();
const CACHE_TTL = 60 * 1000; // 1 minute

export function registerMessageCreateEvent(client: Client): void {
    client.on(Events.MessageCreate, async (message: Message) => {
        // Ignore bots
        if (message.author.bot) return;
        if (!message.guild) return;

        // Handle counting
        await handleCounting(message);

        // Handle keyword replies
        await handleKeywordReplies(message);
    });
}

/**
 * Build a counting feedback embed
 */
function buildCountingEmbed(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    description: string,
    currentCount?: number,
    highScore?: number
): EmbedBuilder {
    const colors = {
        success: COUNTING_COLORS.SUCCESS,
        error: COUNTING_COLORS.ERROR,
        warning: COUNTING_COLORS.WARNING,
        info: COUNTING_COLORS.INFO
    };

    const embed = new EmbedBuilder()
        .setColor(colors[type])
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (currentCount !== undefined) {
        let footerText = `Current count: ${currentCount}`;
        if (highScore !== undefined && highScore > 0) {
            footerText += ` | High score: ${highScore}`;
        }
        embed.setFooter({ text: footerText });
    }

    return embed;
}

/**
 * Handle counting system with professional embeds
 * Uses caching to avoid DB queries on every message
 */
async function handleCounting(message: Message): Promise<void> {
    try {
        const guildId = message.guild!.id;
        const now = Date.now();

        // Check cache first to quickly reject non-counting-channel messages
        let cachedChannel = countingChannelCache.get(guildId);

        if (!cachedChannel || cachedChannel.expiresAt < now) {
            // Cache miss or expired - query DB for countingChannelId only
            const config = await ServerConfig.findOne({ guildId }).select('countingChannelId').lean();
            cachedChannel = {
                channelId: config?.countingChannelId || null,
                expiresAt: now + COUNTING_CACHE_TTL
            };
            countingChannelCache.set(guildId, cachedChannel);
        }

        // Early exit: Not the counting channel
        if (!cachedChannel.channelId || cachedChannel.channelId !== message.channel.id) {
            return;
        }

        // It IS the counting channel - now fetch the full config for validation
        const config = await ServerConfig.findOne({ guildId });

        if (!config) return;

        const channel = message.channel as TextChannel;
        const botMember = message.guild!.members.me;
        const canDelete = botMember?.permissionsIn(channel.id).has(PermissionFlagsBits.ManageMessages);
        const canSendMessages = botMember?.permissionsIn(channel.id).has(PermissionFlagsBits.SendMessages);

        // Parse the number from the message
        const content = message.content.trim();
        const parsed = parseInt(content);

        // Not a number - delete if possible (silent handling)
        if (isNaN(parsed) || content !== parsed.toString()) {
            if (canDelete) {
                await message.delete().catch(() => { });
            }
            return;
        }

        const expectedNumber = (config.currentCount || 0) + 1;
        const resetOnFail = config.countingResetOnFail !== false; // Default true

        // Wrong number
        if (parsed !== expectedNumber) {
            await message.react('❌').catch(() => { });

            if (canSendMessages) {
                const newCount = resetOnFail ? 0 : (config.currentCount || 0);
                const embed = buildCountingEmbed(
                    'error',
                    'Wrong Number',
                    `<@${message.author.id}> entered **${parsed}** but the next number was **${expectedNumber}**.` +
                    (resetOnFail ? '\n\nThe count has been reset to **0**.' : ''),
                    newCount,
                    config.countingHighScore || 0
                );

                // Update if reset on fail
                if (resetOnFail) {
                    await ServerConfig.findOneAndUpdate(
                        { guildId: message.guild!.id },
                        { currentCount: 0, lastCountUserId: null }
                    );
                }

                const reply = await channel.send({ embeds: [embed] });
                setTimeout(() => reply.delete().catch(() => { }), 10000);
            }
            return;
        }

        // Same user counted twice
        if (config.lastCountUserId === message.author.id) {
            await message.react('❌').catch(() => { });

            if (canSendMessages) {
                const newCount = resetOnFail ? 0 : (config.currentCount || 0);
                const embed = buildCountingEmbed(
                    'warning',
                    'Consecutive Count',
                    `<@${message.author.id}>, you cannot count twice in a row!\n\n` +
                    `Wait for someone else to count before you count again.` +
                    (resetOnFail ? '\n\nThe count has been reset to **0**.' : ''),
                    newCount,
                    config.countingHighScore || 0
                );

                // Update if reset on fail
                if (resetOnFail) {
                    await ServerConfig.findOneAndUpdate(
                        { guildId: message.guild!.id },
                        { currentCount: 0, lastCountUserId: null }
                    );
                }

                const reply = await channel.send({ embeds: [embed] });
                setTimeout(() => reply.delete().catch(() => { }), 10000);
            }
            return;
        }

        // ✅ Correct count!
        const currentHighScore = config.countingHighScore || 0;
        const newHighScore = parsed > currentHighScore ? parsed : currentHighScore;

        await ServerConfig.findOneAndUpdate(
            { guildId: message.guild!.id },
            {
                currentCount: parsed,
                lastCountUserId: message.author.id,
                countingHighScore: newHighScore
            }
        );

        await message.react('✅').catch(() => { });

        // Milestone celebration embeds (every 100)
        if (parsed > 0 && parsed % 100 === 0 && canSendMessages) {
            const embed = buildCountingEmbed(
                'success',
                'Milestone Reached',
                `Congratulations! The count has reached **${parsed}**!\n\n` +
                `Keep going, counters!`,
                parsed,
                newHighScore
            );
            await channel.send({ embeds: [embed] });
        }

        // New high score celebration
        if (parsed > currentHighScore && currentHighScore > 0 && canSendMessages) {
            const embed = buildCountingEmbed(
                'success',
                'New High Score',
                `<@${message.author.id}> just set a new high score of **${parsed}**!\n\n` +
                `Previous record: **${currentHighScore}**`,
                parsed,
                parsed
            );
            await channel.send({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error handling counting:', error);
    }
}

/**
 * Handle keyword-based auto replies
 * Uses caching to avoid database queries on every message
 */
async function handleKeywordReplies(message: Message): Promise<void> {
    try {
        const guildId = message.guild!.id;

        // Check cache first
        let cachedData = keywordCache.get(guildId);
        const now = Date.now();

        // Refresh cache if expired or missing
        if (!cachedData || cachedData.expiresAt < now) {
            const keywords = await KeywordReply.find({ guildId });
            cachedData = {
                keywords: keywords.map(k => ({ keyword: k.keyword, response: k.response })),
                expiresAt: now + CACHE_TTL
            };
            keywordCache.set(guildId, cachedData);
        }

        if (cachedData.keywords.length === 0) return;

        const content = message.content.toLowerCase();

        for (const keyword of cachedData.keywords) {
            if (content.includes(keyword.keyword.toLowerCase())) {
                await message.reply(keyword.response);
                break; // Only one reply per message
            }
        }
    } catch (error) {
        console.error('Error handling keyword replies:', error);
    }
}

/**
 * Invalidate keyword cache for a guild (call when keywords are added/removed)
 */
export function invalidateKeywordCache(guildId: string): void {
    keywordCache.delete(guildId);
}

/**
 * Invalidate counting channel cache for a guild (call when counting channel is changed)
 */
export function invalidateCountingChannelCache(guildId: string): void {
    countingChannelCache.delete(guildId);
}

// Cleanup expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    keywordCache.sweep(entry => entry.expiresAt < now);
    countingChannelCache.sweep(entry => entry.expiresAt < now);
}, 60 * 1000);
