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
    .setName('add-keyword-reply')
    .setDescription('Add an auto-reply keyword')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('keyword')
            .setDescription('Trigger keyword')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('response')
            .setDescription('Auto-reply message')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const keyword = interaction.options.getString('keyword', true).toLowerCase();
    const response = interaction.options.getString('response', true);

    // Check for existing
    const existing = await KeywordReply.findOne({
        guildId: interaction.guild.id,
        keyword
    });

    if (existing) {
        await interaction.editReply({
            embeds: [errorEmbed(`Keyword "${keyword}" already exists. Remove it first.`)]
        });
        return;
    }

    await KeywordReply.create({
        guildId: interaction.guild.id,
        keyword,
        response
    });

    // Invalidate cache so the new keyword takes effect immediately
    invalidateKeywordCache(interaction.guild.id);

    await interaction.editReply({
        embeds: [successEmbed(`Keyword added!\n\n**Trigger:** \`${keyword}\`\n**Response:** ${response}`)]
    });
}
