import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { config, isYouTubeConfigured } from '../config/env';
import { ServerConfig, YoutubePingMode } from '../database/models';
import fetch from 'node-fetch';

interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
}

// YouTube brand color
const YOUTUBE_RED = 0xFF0000;

// Quota-safe API configuration
const MAX_BACKOFF_MS = 3600000; // 1 hour max backoff
const INITIAL_BACKOFF_MS = 60000; // 1 minute initial backoff

export class AlertService {
    private client: Client;
    private checkInterval: NodeJS.Timeout | null = null;
    private uploadsPlaylistId: string | null = null;
    private lastKnownVideoId: string | null = null; // Global cache to avoid redundant API calls
    private currentBackoffMs: number = 0; // Exponential backoff for quota errors
    private nextCheckTime: number = 0;

    constructor(client: Client) {
        this.client = client;
    }

    /**
     * Start polling for YouTube alerts
     */
    start(): void {
        if (!isYouTubeConfigured()) {
            console.log('⚠️ YouTube alerts not configured - skipping alert service');
            return;
        }

        const intervalMs = config.alertPollingInterval;
        console.log(`📢 YouTube alert polling started (interval: ${intervalMs / 1000}s)`);

        // Check at configured interval
        this.checkInterval = setInterval(() => {
            this.runCheck();
        }, intervalMs);

        // Initial check after 10 seconds (gives time for uploads playlist ID fetch)
        setTimeout(() => {
            this.initializeAndCheck();
        }, 10000);
    }

    /**
     * Stop polling
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Initialize uploads playlist ID and run first check
     */
    private async initializeAndCheck(): Promise<void> {
        try {
            await this.fetchUploadsPlaylistId();
            await this.checkYouTubeAlerts();
        } catch (error) {
            console.error('YouTube alert initialization error:', error);
        }
    }

    /**
     * Run a check with backoff awareness
     */
    private async runCheck(): Promise<void> {
        // Check if we're in backoff period
        if (this.currentBackoffMs > 0 && Date.now() < this.nextCheckTime) {
            const remainingMs = this.nextCheckTime - Date.now();
            console.log(`⏳ YouTube API in backoff, ${Math.ceil(remainingMs / 1000)}s remaining`);
            return;
        }

        try {
            await this.checkYouTubeAlerts();
            // Reset backoff on success
            this.currentBackoffMs = 0;
        } catch (error) {
            console.error('YouTube alert check error:', error);
        }
    }

    /**
     * Fetch the uploads playlist ID for the configured channel
     * Uses channels.list API (1 quota unit) - only called once at startup
     */
    private async fetchUploadsPlaylistId(): Promise<void> {
        const { channelId, apiKey } = config.youtube;
        if (!channelId || !apiKey) return;

        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
            );

            if (!response.ok) {
                console.error('YouTube channels API error:', response.status, response.statusText);
                return;
            }

            const data = await response.json() as {
                items?: Array<{
                    contentDetails?: {
                        relatedPlaylists?: {
                            uploads?: string;
                        };
                    };
                }>;
            };

            if (data.items && data.items.length > 0) {
                this.uploadsPlaylistId = data.items[0].contentDetails?.relatedPlaylists?.uploads || null;
                if (this.uploadsPlaylistId) {
                    console.log(`📋 YouTube uploads playlist ID cached: ${this.uploadsPlaylistId}`);
                }
            }
        } catch (error) {
            console.error('Failed to fetch uploads playlist ID:', error);
        }
    }

    /**
     * Check for new YouTube videos using playlistItems API (1 quota unit per call)
     * This is 100x more efficient than the search API
     */
    private async checkYouTubeAlerts(): Promise<void> {
        const { apiKey } = config.youtube;
        if (!apiKey || !this.uploadsPlaylistId) {
            // Try to initialize playlist ID if not set
            if (!this.uploadsPlaylistId) {
                await this.fetchUploadsPlaylistId();
                if (!this.uploadsPlaylistId) return;
            }
        }

        try {
            // Use playlistItems API - costs only 1 quota unit vs 100 for search
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${this.uploadsPlaylistId}&maxResults=1&key=${apiKey}`
            );

            // Handle quota errors with exponential backoff
            if (response.status === 403 || response.status === 429) {
                this.handleQuotaError();
                return;
            }

            if (!response.ok) {
                console.error('YouTube API error:', response.status, response.statusText);
                return;
            }

            const data = await response.json() as { items?: any[] };
            if (!data.items || data.items.length === 0) return;

            const item = data.items[0];
            const videoId = item.snippet.resourceId?.videoId;

            if (!videoId) return;

            // Check global cache first - if same video, skip DB queries entirely
            if (this.lastKnownVideoId === videoId) {
                return; // No new video, nothing to do
            }

            // Update global cache
            this.lastKnownVideoId = videoId;

            // Get all servers with YouTube alerts enabled
            const servers = await ServerConfig.find({
                youtubeEnabled: true,
                youtubeChannelId: { $exists: true, $ne: null }
            });

            for (const server of servers) {
                // Check if this is a new video for this server
                if (server.lastYoutubeVideoId === videoId) continue;

                // Update last video ID atomically to prevent duplicates
                const updated = await ServerConfig.findOneAndUpdate(
                    {
                        guildId: server.guildId,
                        lastYoutubeVideoId: { $ne: videoId }
                    },
                    { lastYoutubeVideoId: videoId },
                    { new: true }
                );

                // If update failed, another process already sent this alert
                if (!updated) continue;

                // Send alert with ping configuration
                await this.sendYouTubeAlert(
                    server.youtubeChannelId!,
                    {
                        id: videoId,
                        title: item.snippet.title,
                        description: item.snippet.description || '',
                        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
                        channelTitle: item.snippet.channelTitle || item.snippet.videoOwnerChannelTitle || '',
                        publishedAt: item.snippet.publishedAt
                    },
                    server.youtubePingMode || 'none',
                    server.youtubePingRoleId
                );
            }
        } catch (error) {
            console.error('YouTube alert check failed:', error);
        }
    }

    /**
     * Handle quota errors with exponential backoff
     */
    private handleQuotaError(): void {
        if (this.currentBackoffMs === 0) {
            this.currentBackoffMs = INITIAL_BACKOFF_MS;
        } else {
            this.currentBackoffMs = Math.min(this.currentBackoffMs * 2, MAX_BACKOFF_MS);
        }

        this.nextCheckTime = Date.now() + this.currentBackoffMs;
        console.warn(`⚠️ YouTube API quota error - backing off for ${this.currentBackoffMs / 1000}s`);
    }

    /**
     * Send YouTube alert to a channel with professional embed
     */
    private async sendYouTubeAlert(
        channelId: string,
        video: YouTubeVideo,
        pingMode: YoutubePingMode,
        pingRoleId?: string
    ): Promise<void> {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !(channel instanceof TextChannel)) return;

            // Build professional YouTube embed
            const embed = new EmbedBuilder()
                .setColor(YOUTUBE_RED)
                .setAuthor({
                    name: video.channelTitle,
                    iconURL: 'https://www.youtube.com/s/desktop/f506bd45/img/favicon_144x144.png'
                })
                .setTitle(video.title)
                .setURL(`https://www.youtube.com/watch?v=${video.id}`)
                .setImage(video.thumbnail)
                .setTimestamp(new Date(video.publishedAt))
                .setFooter({ text: 'YouTube • New Upload' });

            // Add description if available (truncated)
            if (video.description) {
                const truncated = video.description.length > 200
                    ? video.description.substring(0, 197) + '...'
                    : video.description;
                embed.setDescription(truncated);
            }

            // Build ping string based on config
            let pingContent = '';
            switch (pingMode) {
                case 'everyone':
                    pingContent = '@everyone ';
                    break;
                case 'here':
                    pingContent = '@here ';
                    break;
                case 'role':
                    if (pingRoleId) {
                        // Verify role still exists
                        try {
                            const guild = channel.guild;
                            const role = await guild.roles.fetch(pingRoleId);
                            if (role) {
                                pingContent = `<@&${pingRoleId}> `;
                            }
                        } catch {
                            // Role doesn't exist anymore, skip ping
                        }
                    }
                    break;
                default:
                    // No ping
                    break;
            }

            await channel.send({
                content: `${pingContent}🎬 **New Video Posted!**`,
                embeds: [embed]
            });

            console.log(`📢 YouTube alert sent for "${video.title}" to channel ${channelId}`);
        } catch (error) {
            console.error('Failed to send YouTube alert:', error);
        }
    }
}
