import mongoose, { Schema, Document } from 'mongoose';
import { EmbedConfig } from '../../types';

// Category scope determines which categories appear in the panel
export type CategoryScope = 'commission' | 'non-commission' | 'both';

export interface ITicketPanel extends Document {
    panelId: string;
    guildId: string;
    channelId: string;
    messageId: string;
    categoryIds: string[];
    embedConfig: EmbedConfig;
    buttonLabel: string;
    buttonEmoji?: string;
    categoryScope: CategoryScope;
    createdAt: Date;
}

const TicketPanelSchema = new Schema<ITicketPanel>({
    panelId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    categoryIds: [{ type: String }],
    embedConfig: {
        title: String,
        description: String,
        color: String,
        thumbnail: String,
        image: String,
        footer: String,
        fields: [{ name: String, value: String, inline: Boolean }]
    },
    buttonLabel: { type: String, default: 'Create Ticket' },
    buttonEmoji: { type: String },
    // Default to 'both' for backward compatibility with existing panels
    categoryScope: { type: String, enum: ['commission', 'non-commission', 'both'], default: 'both' }
}, {
    timestamps: true
});

// Compound index for efficient lookups
TicketPanelSchema.index({ guildId: 1, channelId: 1 });

export const TicketPanel = mongoose.model<ITicketPanel>('TicketPanel', TicketPanelSchema);
