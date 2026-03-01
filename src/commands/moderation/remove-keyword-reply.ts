import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import { KeywordReply } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';
import { invalidateKeywordCache } from '../../events/messageCreate';

export const data = new SlashCommandBuilder()
    .setName('remove-keyword-reply')
    .setDescription('Remove an auto-reply keyword')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('keyword')
            .setDescription('Keyword to remove')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const keyword = interaction.options.getString('keyword', true).toLowerCase();

    const result = await KeywordReply.findOneAndDelete({
        guildId: interaction.guild.id,
        keyword
    });

    if (!result) {
        await interaction.editReply({
            embeds: [errorEmbed(`Keyword "${keyword}" not found.`)]
        });
        return;
    }

    // Invalidate cache so the removal takes effect immediately
    invalidateKeywordCache(interaction.guild.id);

    await interaction.editReply({
        embeds: [successEmbed(`Keyword "${keyword}" removed.`)]
    });
}
