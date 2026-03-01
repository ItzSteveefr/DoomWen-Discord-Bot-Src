import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType
} from 'discord.js';
import { ServerConfig, YoutubePingMode } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('set-youtube-channel')
    .setDescription('Configure YouTube upload alerts')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub
            .setName('enable')
            .setDescription('Enable YouTube alerts')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('Channel for alerts')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('ping-mode')
                    .setDescription('Who to ping when a new video is posted')
                    .setRequired(true)
                    .addChoices(
                        { name: 'No Ping', value: 'none' },
                        { name: '@everyone', value: 'everyone' },
                        { name: '@here', value: 'here' },
                        { name: 'Specific Role', value: 'role' }
                    )
            )
            .addRoleOption(option =>
                option
                    .setName('ping-role')
                    .setDescription('Role to ping (required if ping-mode is "role")')
                    .setRequired(false)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('disable')
            .setDescription('Disable YouTube alerts')
    )
    .addSubcommand(sub =>
        sub
            .setName('status')
            .setDescription('Check current YouTube alert configuration')
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'enable') {
        const channel = interaction.options.getChannel('channel', true);
        const pingMode = interaction.options.getString('ping-mode', true) as YoutubePingMode;
        const pingRole = interaction.options.getRole('ping-role');

        // Validate role requirement
        if (pingMode === 'role' && !pingRole) {
            await interaction.editReply({
                embeds: [errorEmbed('You must select a role when ping mode is set to "Specific Role".')]
            });
            return;
        }

        await ServerConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            {
                guildId: interaction.guild.id,
                youtubeEnabled: true,
                youtubeChannelId: channel.id,
                youtubePingMode: pingMode,
                youtubePingRoleId: pingMode === 'role' ? pingRole?.id : undefined
            },
            { upsert: true }
        );

        let pingDescription = '';
        switch (pingMode) {
            case 'everyone': pingDescription = 'with @everyone ping'; break;
            case 'here': pingDescription = 'with @here ping'; break;
            case 'role': pingDescription = `pinging <@&${pingRole?.id}>`; break;
            default: pingDescription = 'without pings';
        }

        await interaction.editReply({
            embeds: [successEmbed(
                `YouTube alerts enabled in <#${channel.id}> ${pingDescription}.\n\n` +
                `New video notifications will be sent to this channel.`
            )]
        });
    } else if (subcommand === 'disable') {
        await ServerConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { youtubeEnabled: false },
            { upsert: true }
        );

        await interaction.editReply({
            embeds: [successEmbed('YouTube alerts disabled.')]
        });
    } else if (subcommand === 'status') {
        const config = await ServerConfig.findOne({ guildId: interaction.guild.id });

        if (!config?.youtubeEnabled || !config.youtubeChannelId) {
            await interaction.editReply({
                embeds: [errorEmbed('YouTube alerts are not configured for this server.')]
            });
            return;
        }

        let pingInfo = '';
        switch (config.youtubePingMode) {
            case 'everyone': pingInfo = '@everyone'; break;
            case 'here': pingInfo = '@here'; break;
            case 'role': pingInfo = config.youtubePingRoleId ? `<@&${config.youtubePingRoleId}>` : 'Role (not set)'; break;
            default: pingInfo = 'No ping';
        }

        await interaction.editReply({
            embeds: [successEmbed(
                `**YouTube Alert Configuration**\n\n` +
                `**Channel:** <#${config.youtubeChannelId}>\n` +
                `**Ping Mode:** ${pingInfo}\n` +
                `**Status:** ✅ Enabled`
            )]
        });
    }
}
