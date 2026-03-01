import mongoose, { Schema, Document } from 'mongoose';
import { EmbedConfig } from '../../types';

// YouTube ping mode options
export type YoutubePingMode = 'none' | 'everyone' | 'here' | 'role';

export interface IServerConfig extends Document {
    guildId: string;

    // Welcome System
    welcomeEnabled: boolean;
    welcomeChannelId?: string;
    welcomeEmbed?: EmbedConfig;

    // Counting System
    countingChannelId?: string;
    currentCount: number;
    lastCountUserId?: string;
    countingResetOnFail: boolean;
    countingHighScore: number;

    // YouTube Alerts
    youtubeEnabled: boolean;
    youtubeChannelId?: string;
    lastYoutubeVideoId?: string;
    youtubePingMode: YoutubePingMode;
    youtubePingRoleId?: string;

    createdAt: Date;
    updatedAt: Date;
}

const ServerConfigSchema = new Schema<IServerConfig>({
    guildId: { type: String, required: true, unique: true, index: true },

    // Welcome System
    welcomeEnabled: { type: Boolean, default: false },
    welcomeChannelId: { type: String },
    welcomeEmbed: {
        title: String,
        description: String,
        color: String,
        thumbnail: String,
        image: String,
        footer: String,
        fields: [{ name: String, value: String, inline: Boolean }]
    },

    // Counting System
    countingChannelId: { type: String },
    currentCount: { type: Number, default: 0 },
    lastCountUserId: { type: String },
    countingResetOnFail: { type: Boolean, default: true },
    countingHighScore: { type: Number, default: 0 },

    // YouTube Alerts
    youtubeEnabled: { type: Boolean, default: false },
    youtubeChannelId: { type: String },
    lastYoutubeVideoId: { type: String },
    youtubePingMode: { type: String, enum: ['none', 'everyone', 'here', 'role'], default: 'none' },
    youtubePingRoleId: { type: String }
}, {
    timestamps: true
});

export const ServerConfig = mongoose.model<IServerConfig>('ServerConfig', ServerConfigSchema);
