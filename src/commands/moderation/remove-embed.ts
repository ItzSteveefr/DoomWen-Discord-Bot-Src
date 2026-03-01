import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits
} from 'discord.js';
import { StoredEmbed } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('remove-embed')
    .setDescription('Remove a stored embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Embed name to remove')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const name = interaction.options.getString('name', true);

    // Find and delete embed
    const result = await StoredEmbed.findOneAndDelete({
        guildId: interaction.guild.id,
        name
    });

    if (!result) {
        await interaction.editReply({
            embeds: [errorEmbed(`Embed "${name}" not found.`)]
        });
        return;
    }

    await interaction.editReply({
        embeds: [successEmbed(`Embed "${name}" has been removed.`)]
    });
}
