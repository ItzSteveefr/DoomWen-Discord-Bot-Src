import {
    Collection,
    ChatInputCommandInteraction,
    REST,
    Routes,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    MessageFlags
} from 'discord.js';
import { config } from '../config/env';

// Command modules
import * as setTicketPanel from './ticket/set-ticket-panel';
import * as addCategory from './ticket/add-category';
import * as addModal from './ticket/add-modal';
import * as removeCategory from './ticket/remove-category';
import * as removeModal from './ticket/remove-modal';
import * as closeTicket from './ticket/close-ticket';
import * as ticketAddUser from './ticket/ticket-add-user';
import * as commissionDashboard from './ticket/commission-dashboard';
import * as configureWelcome from './welcome/configure-welcome';
import * as setYoutubeChannel from './alerts/set-youtube-channel';
import * as addKeywordReply from './moderation/add-keyword-reply';
import * as removeKeywordReply from './moderation/remove-keyword-reply';
import * as createEmbed from './moderation/create-embed';
import * as sendEmbed from './moderation/send-embed';
import * as removeEmbed from './moderation/remove-embed';
import * as setCountingChannel from './counting/set-counting-channel';
import * as reactionRole from './roles/reaction-role';
import * as adminReload from './admin/reload';
import * as dashboard from './admin/dashboard';

interface Command {
    data: { toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody; name: string };
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// All commands
const commands: Command[] = [
    setTicketPanel,
    addCategory,
    addModal,
    removeCategory,
    removeModal,
    closeTicket,
    ticketAddUser,
    commissionDashboard,
    configureWelcome,
    setYoutubeChannel,
    addKeywordReply,
    removeKeywordReply,
    createEmbed,
    sendEmbed,
    removeEmbed,
    setCountingChannel,
    reactionRole,
    adminReload,
    dashboard,
];

// Command collection for runtime lookup
const commandCollection = new Collection<string, Command>();
commands.forEach(cmd => {
    commandCollection.set(cmd.data.name, cmd);
});

/**
 * Register slash commands with Discord
 */
export async function registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    try {
        console.log('🔄 Registering slash commands...');

        const commandData = commands.map(cmd => cmd.data.toJSON());

        // Register globally
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commandData }
        );

        console.log(`✅ Registered ${commands.length} slash commands globally`);
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }
}

/**
 * Handle slash command execution
 */
export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = commandCollection.get(interaction.commandName);

    if (!command) {
        await interaction.reply({
            content: '❌ Unknown command',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);

        const errorMessage = '❌ An error occurred while executing this command.';

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
    }
}
