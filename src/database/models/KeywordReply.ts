import mongoose, { Schema, Document } from 'mongoose';

export interface IKeywordReply extends Document {
    guildId: string;
    keyword: string;
    response: string;
    createdAt: Date;
}

const KeywordReplySchema = new Schema<IKeywordReply>({
    guildId: { type: String, required: true, index: true },
    keyword: { type: String, required: true },
    response: { type: String, required: true }
}, {
    timestamps: true
});

// Compound unique index to prevent duplicate keywords per server
KeywordReplySchema.index({ guildId: 1, keyword: 1 }, { unique: true });

export const KeywordReply = mongoose.model<IKeywordReply>('KeywordReply', KeywordReplySchema);
