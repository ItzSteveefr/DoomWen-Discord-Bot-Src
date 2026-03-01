import mongoose, { Schema, Document } from 'mongoose';
import { RoleMapping } from '../../types';

export interface IReactionRole extends Document {
    guildId: string;
    messageId: string;
    channelId: string;
    mappings: RoleMapping[];
    createdAt: Date;
}

const ReactionRoleSchema = new Schema<IReactionRole>({
    guildId: { type: String, required: true, index: true },
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    mappings: [{
        emoji: { type: String, required: true },
        roleId: { type: String, required: true }
    }]
}, {
    timestamps: true
});

export const ReactionRole = mongoose.model<IReactionRole>('ReactionRole', ReactionRoleSchema);
