import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    PermissionsBitField,
    TextChannel,
    MessageFlags
} from 'discord.js';
import { Ticket, TicketCategory } from '../../database/models';
import { errorEmbed, successEmbed } from '../../utils/embeds';
import { hasAnyRole, isOwner } from '../../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('ticket-add-user')
    .setDescription('Add a user to the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const targetUser = interaction.options.getUser('user', true);

    // Find ticket for this channel
    const ticket = await Ticket.findOne({
        guildId: interaction.guild.id,
        channelId: interaction.channel.id
    });

    if (!ticket) {
        await interaction.editReply({
            embeds: [errorEmbed('This command can only be used inside a ticket channel.')]
        });
        return;
    }

    // Get member
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Get category to check admin roles
    const category = await TicketCategory.findOne({ categoryId: ticket.categoryId });
    if (!category) {
        await interaction.editReply({ embeds: [errorEmbed('Category not found')] });
        return;
    }

    // Permission check: Admin role, ticket owner, or bot owner
    const isAdmin = hasAnyRole(member, category.adminRoleIds);
    const isTicketOwner = ticket.userId === interaction.user.id;

    if (!isAdmin && !isTicketOwner && !isOwner(interaction.user.id)) {
        await interaction.editReply({
            embeds: [errorEmbed('You do not have permission to add users to this ticket.')]
        });
        return;
    }

    // Verify target user exists in guild
    let targetMember;
    try {
        targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
        await interaction.editReply({
            embeds: [errorEmbed('Could not find that user in this server.')]
        });
        return;
    }

    // Add permission overwrites to the channel
    const channel = interaction.channel as TextChannel;
    try {
        await channel.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });
    } catch (error) {
        console.error('Error adding user to ticket:', error);
        await interaction.editReply({
            embeds: [errorEmbed('Failed to add user to ticket. Check bot permissions.')]
        });
        return;
    }

    // Log in channel
    await channel.send({
        content: `📥 <@${targetUser.id}> has been added to this ticket by <@${interaction.user.id}>.`
    });

    await interaction.editReply({
        embeds: [successEmbed(`<@${targetUser.id}> has been added to this ticket.`)]
    });
}
