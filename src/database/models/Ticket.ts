import mongoose, { Schema, Document } from 'mongoose';
import { TicketState } from '../../state';
import { FormResponse } from '../../types';

export interface ITicket extends Document {
    ticketId: string;
    guildId: string;
    channelId: string;
    userId: string;
    categoryId: string;
    panelId: string;
    state: TicketState;
    isCommission: boolean;
    formResponses: FormResponse[];
    createdAt: Date;
    closedAt?: Date;
    closedBy?: string;
    transcriptUrl?: string;
}

const TicketSchema = new Schema<ITicket>({
    ticketId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true },
    panelId: { type: String, required: true },
    state: {
        type: String,
        enum: Object.values(TicketState),
        default: TicketState.OPEN
    },
    isCommission: { type: Boolean, default: false },
    formResponses: [{
        questionId: String,
        question: String,
        answer: String
    }],
    closedAt: Date,
    closedBy: String,
    transcriptUrl: String
}, {
    timestamps: true
});

// Compound indexes for common queries
TicketSchema.index({ guildId: 1, userId: 1, categoryId: 1 });
TicketSchema.index({ guildId: 1, state: 1 });

// Partial unique index: Prevent duplicate open tickets per user per category
// This closes the race condition window when users spam-click the create button
TicketSchema.index(
    { guildId: 1, userId: 1, categoryId: 1 },
    {
        unique: true,
        partialFilterExpression: { state: { $ne: 'CLOSED' } },
        name: 'unique_open_ticket_per_user_category'
    }
);

/**
 * Check if user has an open ticket in a specific category
 */
TicketSchema.statics.hasOpenTicket = async function (
    guildId: string,
    userId: string,
    categoryId: string
): Promise<boolean> {
    const count = await this.countDocuments({
        guildId,
        userId,
        categoryId,
        state: { $ne: TicketState.CLOSED }
    });
    return count > 0;
};

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
