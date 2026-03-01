import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import { StoredEmbed } from '../../database/models';
import { generateId } from '../../utils/validation';
import { successEmbed, errorEmbed, buildEmbedFromConfig } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('create-embed')
    .setDescription('Create a reusable embed for announcements/rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Embed name for reference')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('title')
            .setDescription('Embed title')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('Embed description')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('color')
            .setDescription('Embed color (hex code)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('image')
            .setDescription('Image URL')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('footer')
            .setDescription('Footer text')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const name = interaction.options.getString('name', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const color = interaction.options.getString('color') || '#5865F2';
    const image = interaction.options.getString('image');
    const footer = interaction.options.getString('footer');

    // Check for duplicate name
    const existing = await StoredEmbed.findOne({
        guildId: interaction.guild.id,
        name
    });

    if (existing) {
        await interaction.editReply({
            embeds: [errorEmbed(`Embed "${name}" already exists.`)]
        });
        return;
    }

    const embedId = generateId('embed');

    await StoredEmbed.create({
        embedId,
        guildId: interaction.guild.id,
        name,
        embedConfig: {
            title,
            description,
            color,
            image,
            footer
        }
    });

    // Show preview
    const previewEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color as any);

    if (image) previewEmbed.setImage(image);
    if (footer) previewEmbed.setFooter({ text: footer });

    await interaction.editReply({
        content: `✅ Embed "${name}" created! Use \`/send-embed name:${name}\` to send it.`,
        embeds: [previewEmbed]
    });
}
