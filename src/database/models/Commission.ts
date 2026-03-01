import mongoose, { Schema, Document } from 'mongoose';
import { CommissionState } from '../../state';

export interface ICommission extends Document {
    commissionId: string;
    ticketId: string;
    guildId: string;
    state: CommissionState;
    freelancerId?: string;
    customerId: string;

    // Final accepted price/deadline
    price?: string;
    deadline?: string;

    // Quote details (before acceptance)
    quotedPrice?: string;
    quotedDeadline?: string;
    quotedBy?: string;
    quotedAt?: Date;

    customerConfirmed: boolean;
    lastFreelancerPing?: Date;
    startedAt?: Date;
    endedAt?: Date;
    createdAt: Date;
}

const CommissionSchema = new Schema<ICommission>({
    commissionId: { type: String, required: true, unique: true },
    ticketId: { type: String, required: true, unique: true, index: true },
    guildId: { type: String, required: true, index: true },
    state: {
        type: String,
        enum: Object.values(CommissionState),
        default: CommissionState.OPEN
    },
    freelancerId: { type: String },
    customerId: { type: String, required: true },

    // Final accepted values
    price: { type: String },
    deadline: { type: String },

    // Quote (pending approval)
    quotedPrice: { type: String },
    quotedDeadline: { type: String },
    quotedBy: { type: String },
    quotedAt: { type: Date },

    customerConfirmed: { type: Boolean, default: false },
    lastFreelancerPing: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date }
}, {
    timestamps: true
});

// Compound indexes
CommissionSchema.index({ guildId: 1, state: 1 });
CommissionSchema.index({ freelancerId: 1, state: 1 });

export const Commission = mongoose.model<ICommission>('Commission', CommissionSchema);
