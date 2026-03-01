import { Client, Events } from 'discord.js';

export function registerReadyEvent(client: Client): void {
    client.once(Events.ClientReady, (readyClient) => {
        console.log(`✅ Logged in as ${readyClient.user.tag}`);
        console.log(`📊 Connected to ${readyClient.guilds.cache.size} servers`);
    });
}
