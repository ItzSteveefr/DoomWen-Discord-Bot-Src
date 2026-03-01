import { Client, Events, GuildMember, TextChannel } from 'discord.js';
import { ServerConfig } from '../database/models';
import { buildEmbedFromConfig } from '../utils/embeds';

export function registerGuildMemberAddEvent(client: Client): void {
    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
        try {
            // Get server config
            const config = await ServerConfig.findOne({ guildId: member.guild.id });

            if (!config?.welcomeEnabled || !config.welcomeChannelId || !config.welcomeEmbed) {
                return;
            }

            // Get welcome channel
            const channel = await member.guild.channels.fetch(config.welcomeChannelId);
            if (!channel || !(channel instanceof TextChannel)) {
                return;
            }

            // Build embed with user placeholders
            const embedConfig = { ...config.welcomeEmbed };

            // Replace placeholders
            const replacePlaceholders = (text: string | undefined): string | undefined => {
                if (!text) return text;
                return text
                    .replace(/{user}/g, `<@${member.id}>`)
                    .replace(/{username}/g, member.user.username)
                    .replace(/{server}/g, member.guild.name)
                    .replace(/{memberCount}/g, member.guild.memberCount.toString());
            };

            embedConfig.title = replacePlaceholders(embedConfig.title);
            embedConfig.description = replacePlaceholders(embedConfig.description);
            embedConfig.footer = replacePlaceholders(embedConfig.footer);

            if (embedConfig.fields) {
                embedConfig.fields = embedConfig.fields.map(field => ({
                    ...field,
                    name: replacePlaceholders(field.name) || field.name,
                    value: replacePlaceholders(field.value) || field.value
                }));
            }

            const embed = buildEmbedFromConfig(embedConfig);

            await channel.send({
                content: `Welcome <@${member.id}>! 🎉`,
                embeds: [embed]
            });
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    });
}
