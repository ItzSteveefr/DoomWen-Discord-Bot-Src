import mongoose from 'mongoose';
import { config } from '../config/env';

export async function connectDatabase(): Promise<void> {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (error) => {
    console.error('❌ MongoDB error:', error);
});
