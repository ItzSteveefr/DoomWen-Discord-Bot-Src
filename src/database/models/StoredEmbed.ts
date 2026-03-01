import mongoose, { Schema, Document } from 'mongoose';
import { EmbedConfig } from '../../types';

export interface IStoredEmbed extends Document {
    embedId: string;
    guildId: string;
    name: string;
    embedConfig: EmbedConfig;
    createdAt: Date;
}

const StoredEmbedSchema = new Schema<IStoredEmbed>({
    embedId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    embedConfig: {
        title: String,
        description: String,
        color: String,
        thumbnail: String,
        image: String,
        footer: String,
        fields: [{ name: String, value: String, inline: Boolean }]
    }
}, {
    timestamps: true
});

// Compound unique index to prevent duplicate names per server
StoredEmbedSchema.index({ guildId: 1, name: 1 }, { unique: true });

export const StoredEmbed = mongoose.model<IStoredEmbed>('StoredEmbed', StoredEmbedSchema);
