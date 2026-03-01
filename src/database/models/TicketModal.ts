import mongoose, { Schema, Document } from 'mongoose';
import { ModalQuestion } from '../../types';

export interface ITicketModal extends Document {
    modalId: string;
    guildId: string;
    title: string;
    questions: ModalQuestion[];
    createdAt: Date;
}

const TicketModalSchema = new Schema<ITicketModal>({
    modalId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    questions: [{
        id: { type: String, required: true },
        label: { type: String, required: true },
        placeholder: String,
        style: { type: String, enum: ['SHORT', 'PARAGRAPH'], required: true },
        required: { type: Boolean, default: true },
        minLength: Number,
        maxLength: Number
    }]
}, {
    timestamps: true
});

export const TicketModal = mongoose.model<ITicketModal>('TicketModal', TicketModalSchema);
