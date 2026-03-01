import { Client, Events, MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { ReactionRole } from '../database/models';

export function registerReactionRoleEvents(client: Client): void {
    // Handle reaction add
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        await handleReactionRoleChange(reaction, user, 'add');
    });

    // Handle reaction remove
    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        await handleReactionRoleChange(reaction, user, 'remove');
    });
}

async function handleReactionRoleChange(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    action: 'add' | 'remove'
): Promise<void> {
    try {
        // Ignore bots
        if (user.bot) return;

        // Fetch partial reaction if needed
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Error fetching reaction:', error);
                return;
            }
        }

        const message = reaction.message;
        if (!message.guild) return;

        // Find reaction role config
        const reactionRole = await ReactionRole.findOne({
            messageId: message.id,
            guildId: message.guild.id
        });

        if (!reactionRole) return;

        // Get the emoji identifier
        const emojiIdentifier = reaction.emoji.id
            ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
            : reaction.emoji.name;

        // Find matching role
        const mapping = reactionRole.mappings.find(m =>
            m.emoji === emojiIdentifier || m.emoji === reaction.emoji.name
        );

        if (!mapping) return;

        // Get member
        const member = await message.guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        // Add or remove role
        if (action === 'add') {
            await member.roles.add(mapping.roleId).catch((error) => {
                console.error('Error adding role:', error);
            });
        } else {
            await member.roles.remove(mapping.roleId).catch((error) => {
                console.error('Error removing role:', error);
            });
        }
    } catch (error) {
        console.error('Error handling reaction role:', error);
    }
}
