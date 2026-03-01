import { Client } from 'discord.js';
import { registerReadyEvent } from './ready';
import { registerGuildMemberAddEvent } from './guildMemberAdd';
import { registerMessageCreateEvent } from './messageCreate';
import { registerReactionRoleEvents } from './reactionRoles';

export function registerAllEvents(client: Client): void {
    registerReadyEvent(client);
    registerGuildMemberAddEvent(client);
    registerMessageCreateEvent(client);
    registerReactionRoleEvents(client);

    console.log('📝 All event handlers registered');
}
