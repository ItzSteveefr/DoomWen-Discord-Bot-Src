import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType,
    TextChannel,
    EmbedBuilder
} from 'discord.js';
import { ReactionRole } from '../../database/models';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('reaction-role')
    .setDescription('Configure reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub
            .setName('setup')
            .setDescription('Create a reaction role message')
            .addStringOption(option =>
                option
                    .setName('title')
                    .setDescription('Message title')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('description')
                    .setDescription('Message description')
                    .setRequired(true)
            )
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('Channel to send to')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('add')
            .setDescription('Add a reaction role to a message')
            .addStringOption(option =>
                option
                    .setName('message-id')
                    .setDescription('Message ID to add reaction role to')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('emoji')
                    .setDescription('Emoji to react with')
                    .setRequired(true)
            )
            .addRoleOption(option =>
                option
                    .setName('role')
                    .setDescription('Role to give')
                    .setRequired(true)
            )
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'setup': {
            const title = interaction.options.getString('title', true);
            const description = interaction.options.getString('description', true);
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            if (!targetChannel || !(targetChannel instanceof TextChannel)) {
                await interaction.editReply({
                    embeds: [errorEmbed('Invalid channel')]
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor('#5865F2')
                .setFooter({ text: 'React to get roles!' });

            const message = await targetChannel.send({ embeds: [embed] });

            // Create reaction role entry
            await ReactionRole.create({
                guildId: interaction.guild.id,
                messageId: message.id,
                channelId: targetChannel.id,
                mappings: []
            });

            await interaction.editReply({
                embeds: [successEmbed(
                    `Reaction role message created!\n\n` +
                    `**Message ID:** \`${message.id}\`\n\n` +
                    `Use \`/reaction-role add message-id:${message.id} emoji:🎮 role:@GameRole\` to add roles.`
                )]
            });
            break;
        }

        case 'add': {
            const messageId = interaction.options.getString('message-id', true);
            const emoji = interaction.options.getString('emoji', true);
            const role = interaction.options.getRole('role', true);

            // Find existing reaction role config
            const reactionRole = await ReactionRole.findOne({
                guildId: interaction.guild.id,
                messageId
            });

            if (!reactionRole) {
                await interaction.editReply({
                    embeds: [errorEmbed('Reaction role message not found. Create one with `/reaction-role setup` first.')]
                });
                return;
            }

            // Add mapping
            await ReactionRole.findOneAndUpdate(
                { messageId },
                {
                    $push: {
                        mappings: { emoji, roleId: role.id }
                    }
                }
            );

            // Add reaction to message
            try {
                const channel = await interaction.guild.channels.fetch(reactionRole.channelId);
                if (channel instanceof TextChannel) {
                    const message = await channel.messages.fetch(messageId);
                    await message.react(emoji);
                }
            } catch (error) {
                console.error('Failed to add reaction:', error);
            }

            await interaction.editReply({
                embeds: [successEmbed(`Added reaction role: ${emoji} → <@&${role.id}>`)]
            });
            break;
        }
    }
}
