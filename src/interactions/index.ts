import { Client, Events, Interaction, MessageFlags } from 'discord.js';
import { handleButtonInteraction } from './handlers/buttonHandler';
import { handleSelectMenuInteraction } from './handlers/selectMenuHandler';
import { handleModalSubmitInteraction } from './handlers/modalHandler';

export function registerInteractionHandler(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        try {
            if (interaction.isChatInputCommand()) {
                // Slash commands are handled by the command module
                const { handleCommand } = await import('../commands');
                await handleCommand(interaction);
            } else if (interaction.isButton()) {
                await handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await handleSelectMenuInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await handleModalSubmitInteraction(interaction);
            }
        } catch (error) {
            console.error('Interaction handling error:', error);

            // Try to respond with an error
            try {
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while processing your request.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch {
                // Best effort
            }
        }
    });

    console.log('🔘 Interaction handler registered');
}
