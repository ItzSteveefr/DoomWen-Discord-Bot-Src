import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} from 'discord.js';
import { ServerConfig } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('configure-welcome')
    .setDescription('Configure the welcome message system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub
            .setName('enable')
            .setDescription('Enable welcome messages')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('Channel to send welcome messages')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('disable')
            .setDescription('Disable welcome messages')
    )
    .addSubcommand(sub =>
        sub
            .setName('set-message')
            .setDescription('Set welcome message content')
            .addStringOption(option =>
                option
                    .setName('title')
                    .setDescription('Welcome embed title')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('description')
                    .setDescription('Welcome message (use {user}, {username}, {server}, {memberCount})')
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
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'enable': {
            const channel = interaction.options.getChannel('channel', true);

            await ServerConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    welcomeEnabled: true,
                    welcomeChannelId: channel.id
                },
                { upsert: true }
            );

            await interaction.editReply({
                embeds: [successEmbed(`Welcome messages enabled in <#${channel.id}>`)]
            });
            break;
        }

        case 'disable': {
            await ServerConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { welcomeEnabled: false },
                { upsert: true }
            );

            await interaction.editReply({
                embeds: [successEmbed('Welcome messages disabled')]
            });
            break;
        }

        case 'set-message': {
            const title = interaction.options.getString('title', true);
            const description = interaction.options.getString('description', true);
            const color = interaction.options.getString('color') || '#5865F2';
            const image = interaction.options.getString('image');

            await ServerConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    welcomeEmbed: {
                        title,
                        description,
                        color,
                        image
                    }
                },
                { upsert: true }
            );

            await interaction.editReply({
                embeds: [successEmbed(
                    `Welcome message updated!\n\n` +
                    `**Title:** ${title}\n` +
                    `**Placeholders:** \`{user}\`, \`{username}\`, \`{server}\`, \`{memberCount}\``
                )]
            });
            break;
        }
    }
}
