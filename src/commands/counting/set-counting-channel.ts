import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType
} from 'discord.js';
import { ServerConfig } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('set-counting-channel')
    .setDescription('Configure the counting channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub
            .setName('set')
            .setDescription('Set the counting channel')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('Channel for counting')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('reset')
            .setDescription('Reset the count to 0')
    )
    .addSubcommand(sub =>
        sub
            .setName('disable')
            .setDescription('Disable counting')
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'set': {
            const channel = interaction.options.getChannel('channel', true);

            await ServerConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    countingChannelId: channel.id,
                    currentCount: 0,
                    lastCountUserId: null
                },
                { upsert: true }
            );

            await interaction.editReply({
                embeds: [successEmbed(`Counting enabled in <#${channel.id}>. Start counting from 1!`)]
            });
            break;
        }

        case 'reset': {
            await ServerConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    currentCount: 0,
                    lastCountUserId: null
                }
            );

            await interaction.editReply({
                embeds: [successEmbed('Count reset to 0. Start from 1!')]
            });
            break;
        }

        case 'disable': {
            await ServerConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { countingChannelId: null }
            );

            await interaction.editReply({
                embeds: [successEmbed('Counting disabled')]
            });
            break;
        }
    }
}
