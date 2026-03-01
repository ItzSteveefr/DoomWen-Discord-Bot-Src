import dotenv from 'dotenv';
dotenv.config(); // ✅ Load .env first, before anything else runs
import { initDecryptor } from './decrypt';

async function main(): Promise<void> {
    console.log('🚀 Starting Doom Wen Discord Bot...');

    // ✅ MUST be first — before any config is loaded
    await initDecryptor();

    // ✅ Dynamic imports so config is only read AFTER key is in memory
    const { Client, GatewayIntentBits, Partials, Events } = await import('discord.js');
    const { config, validateConfig, isYouTubeConfigured } = await import('./config/env');
    const { connectDatabase } = await import('./database/connection');
    const { registerAllEvents } = await import('./events');
    const { registerInteractionHandler } = await import('./interactions');
    const { registerCommands } = await import('./commands');
    const { AlertService } = await import('./services/alertService');

    // Validate configuration (now safe — config is already decrypted)
    validateConfig();

    // Connect to MongoDB
    await connectDatabase();

    // Create Discord client
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions,
        ],
        partials: [
            Partials.Message,
            Partials.Reaction,
            Partials.User,
        ],
    });

    // Register event handlers
    registerAllEvents(client);

    // Register interaction handler
    registerInteractionHandler(client);

    // Register slash commands
    await registerCommands();

    // Start AlertService when client is ready
    client.once(Events.ClientReady, (readyClient) => {
        try {
            console.log(`✅ Logged in as ${readyClient.user.tag}`); // ← fixed syntax bug
            if (isYouTubeConfigured()) {
                const alertService = new AlertService(client);
                alertService.start();
                console.log('📢 Alert service started');
            } else {
                console.log('ℹ️  Alert service not started (YouTube not configured)');
            }
        } catch (error) {
            console.error('❌ Error in ready event:', error);
        }
    });

    // Login — config.discordToken is already decrypted at this point
    await client.login(config.discordToken);
}

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});