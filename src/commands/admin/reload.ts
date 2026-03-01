import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { invalidateKeywordCache, invalidateCountingChannelCache } from '../../events/messageCreate';
import { successEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administrative commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
        subcommand
            .setName('reload')
            .setDescription('Reload bot configuration caches')
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'reload') {
        const guildId = interaction.guildId!;

        // Invalidate caches
        invalidateKeywordCache(guildId);
        invalidateCountingChannelCache(guildId);

        await interaction.reply({
            embeds: [successEmbed('Configuration caches have been cleared. New settings will apply immediately.')],
            flags: MessageFlags.Ephemeral
        });
    }
}
