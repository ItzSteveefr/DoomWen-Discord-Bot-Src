import mongoose, { Schema, Document } from 'mongoose';

export interface ITicketCategory extends Document {
    categoryId: string;
    guildId: string;
    name: string;
    discordCategoryId: string;
    emoji: string;
    modalId?: string;
    freelancerRoleIds: string[];
    adminRoleIds: string[];
    isCommissionCategory: boolean;
    description?: string;
    createdAt: Date;
}

const TicketCategorySchema = new Schema<ITicketCategory>({
    categoryId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    discordCategoryId: { type: String, required: true },
    emoji: { type: String, required: true },
    modalId: { type: String },
    freelancerRoleIds: [{ type: String }],
    adminRoleIds: [{ type: String }],
    isCommissionCategory: { type: Boolean, default: false },
    description: { type: String }
}, {
    timestamps: true
});

// Compound index for efficient lookups
TicketCategorySchema.index({ guildId: 1, name: 1 });

export const TicketCategory = mongoose.model<ITicketCategory>('TicketCategory', TicketCategorySchema);
