import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} from 'discord.js';
import { TicketCategory, TicketModal } from '../../database/models';
import { generateId } from '../../utils/validation';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('add-category')
    .setDescription('Add a ticket category')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Category name')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option
            .setName('discord-category')
            .setDescription('Discord category where tickets will be created')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('emoji')
            .setDescription('Emoji for this category')
            .setRequired(true)
    )
    .addRoleOption(option =>
        option
            .setName('freelancer-role')
            .setDescription('Role that can manage tickets in this category')
            .setRequired(false)
    )
    .addRoleOption(option =>
        option
            .setName('admin-role')
            .setDescription('Admin role for this category')
            .setRequired(false)
    )
    .addBooleanOption(option =>
        option
            .setName('commission')
            .setDescription('Is this a commission category?')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('modal-id')
            .setDescription('ID of an existing modal to use (or leave empty)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('Brief description shown in dropdown')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const name = interaction.options.getString('name', true);
    const discordCategory = interaction.options.getChannel('discord-category', true);
    const emoji = interaction.options.getString('emoji', true);
    const freelancerRole = interaction.options.getRole('freelancer-role');
    const adminRole = interaction.options.getRole('admin-role');
    const isCommissionCategory = interaction.options.getBoolean('commission') ?? false;
    const modalId = interaction.options.getString('modal-id');
    const description = interaction.options.getString('description');

    // Validate modal if provided
    if (modalId) {
        const modal = await TicketModal.findOne({ modalId, guildId: interaction.guild.id });
        if (!modal) {
            await interaction.editReply({
                embeds: [errorEmbed(`Modal with ID \`${modalId}\` not found. Create it first with \`/add-modal\`.`)]
            });
            return;
        }
    }

    // Check for duplicate name
    const existing = await TicketCategory.findOne({ guildId: interaction.guild.id, name });
    if (existing) {
        await interaction.editReply({
            embeds: [errorEmbed(`Category "${name}" already exists.`)]
        });
        return;
    }

    // Generate category ID
    const categoryId = generateId('cat');

    // Create category
    await TicketCategory.create({
        categoryId,
        guildId: interaction.guild.id,
        name,
        discordCategoryId: discordCategory.id,
        emoji,
        modalId,
        freelancerRoleIds: freelancerRole ? [freelancerRole.id] : [],
        adminRoleIds: adminRole ? [adminRole.id] : [],
        isCommissionCategory,
        description
    });

    await interaction.editReply({
        embeds: [successEmbed(
            `Category "${name}" created!\n\n` +
            `**ID:** \`${categoryId}\`\n` +
            `**Emoji:** ${emoji}\n` +
            `**Commission Category:** ${isCommissionCategory ? 'Yes' : 'No'}\n` +
            `**Modal:** ${modalId || 'None (direct creation)'}`
        )]
    });
}
