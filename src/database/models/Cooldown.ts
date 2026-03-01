import mongoose, { Schema, Document } from 'mongoose';

export interface ICooldown extends Document {
    type: string;
    guildId: string;
    targetId: string;
    expiresAt: Date;
}

const CooldownSchema = new Schema<ICooldown>({
    type: { type: String, required: true },
    guildId: { type: String, required: true },
    targetId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL index - auto-deletes expired docs
}, {
    timestamps: true
});

// Compound unique index to prevent duplicates
CooldownSchema.index({ type: 1, guildId: 1, targetId: 1 }, { unique: true });

export const Cooldown = mongoose.model<ICooldown>('Cooldown', CooldownSchema);
