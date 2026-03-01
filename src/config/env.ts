import dotenv from 'dotenv';
dotenv.config();
import { decryptSecret } from '../decrypt';

const e = (val: string) => val ? decryptSecret(val) : '';

export const config = {
    // Discord (required)
    discordToken: e(process.env.DISCORD_TOKEN || ''),
    clientId: process.env.DISCORD_CLIENT_ID || '',       // public, no encryption needed

    // MongoDB
    mongoUri: e(process.env.MONGODB_URI || ''),

    // Owner (hardcoded override for all servers)
    ownerId: process.env.OWNER_ID || '',                 // not sensitive, skip

    // GitHub Transcripts (optional - falls back to attachments)
    github: {
        token: e(process.env.GITHUB_TOKEN || ''),
        repo: process.env.GITHUB_REPO || '',             // not sensitive, skip
        branch: process.env.GITHUB_BRANCH || 'main',
        baseUrl: process.env.TRANSCRIPT_BASE_URL || '',
    },

    // YouTube (optional)
    youtube: {
        channelId: process.env.YOUTUBE_CHANNEL_ID || '', // not sensitive, skip
        apiKey: e(process.env.YOUTUBE_API_KEY || ''),
    },

    // Alert polling interval (configurable, default 10 minutes)
    alertPollingInterval: parseInt(process.env.ALERT_POLLING_INTERVAL || '600000', 10),

    // Constants
    freelancerPingCooldown: 12 * 60 * 60 * 1000,
};

export function isGitHubConfigured(): boolean {
    return !!(config.github.token && config.github.repo && config.github.baseUrl);
}

export function isYouTubeConfigured(): boolean {
    return !!(config.youtube.channelId && config.youtube.apiKey);
}

export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.discordToken) errors.push('DISCORD_TOKEN is required');
    if (!config.clientId) errors.push('DISCORD_CLIENT_ID is required');
    if (!config.ownerId) errors.push('OWNER_ID is required');

    if (errors.length > 0) {
        throw new Error(`Configuration errors:\n${errors.join('\n')}`); // ← fixed syntax bug here too
    }

    if (!isGitHubConfigured()) {
        console.warn('⚠️  GitHub transcript hosting not configured. Transcripts will use fallback mode.');
        console.warn('   Set GITHUB_TOKEN, GITHUB_REPO, and TRANSCRIPT_BASE_URL to enable.');
    }

    if (!isYouTubeConfigured()) {
        console.log('ℹ️  YouTube alerts not configured (optional)');
    }
}