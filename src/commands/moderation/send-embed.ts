import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType,
    TextChannel
} from 'discord.js';
import { StoredEmbed } from '../../database/models';
import { successEmbed, errorEmbed, buildEmbedFromConfig } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('send-embed')
    .setDescription('Send a stored embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Embed name')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Channel to send to (default: current)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const name = interaction.options.getString('name', true);
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const storedEmbed = await StoredEmbed.findOne({
        guildId: interaction.guild.id,
        name
    });

    if (!storedEmbed) {
        await interaction.editReply({
            embeds: [errorEmbed(`Embed "${name}" not found.`)]
        });
        return;
    }

    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
        await interaction.editReply({
            embeds: [errorEmbed('Invalid channel')]
        });
        return;
    }

    const embed = buildEmbedFromConfig(storedEmbed.embedConfig);

    await targetChannel.send({ embeds: [embed] });

    await interaction.editReply({
        embeds: [successEmbed(`Embed sent to <#${targetChannel.id}>`)]
    });
}
