import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    TextChannel,
    MessageFlags
} from 'discord.js';
import { TicketPanel, TicketCategory } from '../../database/models';
import { CategoryScope } from '../../database/models/TicketPanel';
import { generateId } from '../../utils/validation';
import { successEmbed, errorEmbed, buildEmbedFromConfig } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('set-ticket-panel')
    .setDescription('Create a ticket panel in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('title')
            .setDescription('Panel embed title')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('Panel embed description')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('category-scope')
            .setDescription('Which category types to show in this panel')
            .setRequired(false)
            .addChoices(
                { name: 'Commission Only', value: 'commission' },
                { name: 'Non-Commission Only', value: 'non-commission' },
                { name: 'Both (All Categories)', value: 'both' }
            )
    )
    .addStringOption(option =>
        option
            .setName('button-label')
            .setDescription('Label for the ticket button')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('button-emoji')
            .setDescription('Emoji for the ticket button')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('color')
            .setDescription('Embed color (hex code, e.g., #5865F2)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild || !interaction.channel) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const categoryScope = (interaction.options.getString('category-scope') || 'both') as CategoryScope;
    const buttonLabel = interaction.options.getString('button-label') || 'Create Ticket';
    const buttonEmoji = interaction.options.getString('button-emoji') || '🎫';
    const color = interaction.options.getString('color') || '#5865F2';

    // Get all categories for this guild
    let allCategories = await TicketCategory.find({ guildId: interaction.guild.id });

    if (allCategories.length === 0) {
        await interaction.editReply({
            embeds: [errorEmbed('No ticket categories found. Create categories first with `/add-category`.')]
        });
        return;
    }

    // Filter categories based on scope
    let filteredCategories = allCategories;

    if (categoryScope === 'commission') {
        filteredCategories = allCategories.filter(cat => cat.isCommissionCategory === true);
    } else if (categoryScope === 'non-commission') {
        filteredCategories = allCategories.filter(cat => cat.isCommissionCategory === false);
    }
    // 'both' shows all categories

    if (filteredCategories.length === 0) {
        const scopeLabel = categoryScope === 'commission' ? 'commission' : 'non-commission';
        await interaction.editReply({
            embeds: [errorEmbed(`No ${scopeLabel} categories available. Create matching categories first with \`/add-category\`.`)]
        });
        return;
    }

    // Generate panel ID
    const panelId = generateId('panel');

    // Build footer based on scope
    let footerText = 'Select a category to create a ticket';
    if (categoryScope === 'commission') {
        footerText = 'Commission Panel • Select a category';
    } else if (categoryScope === 'non-commission') {
        footerText = 'Support Panel • Select a category';
    }

    // Build category select menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`category_select|${panelId}`)
        .setPlaceholder('Select a ticket category')
        .addOptions(
            filteredCategories.map(cat => ({
                label: cat.name,
                value: cat.categoryId,
                emoji: cat.emoji,
                description: cat.description || (cat.isCommissionCategory ? '💼 Commission' : '🎫 Support')
            }))
        );

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    // Send panel message
    if (!(interaction.channel instanceof TextChannel)) {
        await interaction.editReply({ embeds: [errorEmbed('This command must be used in a text channel')] });
        return;
    }

    const panelMessage = await interaction.channel.send({
        embeds: [buildEmbedFromConfig({
            title,
            description,
            color,
            footer: footerText
        })],
        components: [selectRow]
    });

    // Save panel to database
    await TicketPanel.create({
        panelId,
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: panelMessage.id,
        categoryIds: filteredCategories.map(c => c.categoryId),
        embedConfig: {
            title,
            description,
            color
        },
        buttonLabel,
        buttonEmoji,
        categoryScope
    });

    // Scope label for confirmation
    const scopeDisplay = {
        'commission': 'Commission Only',
        'non-commission': 'Non-Commission Only',
        'both': 'All Categories'
    }[categoryScope];

    // List category names for confirmation
    const categoryNamesList = filteredCategories.map(c => `• ${c.emoji} ${c.name}`).join('\\n');

    await interaction.editReply({
        embeds: [successEmbed(
            `Ticket panel created!\n\n` +
            `**Panel ID:** \`${panelId}\`\n` +
            `**Category Scope:** ${scopeDisplay}\n` +
            `**Categories (${filteredCategories.length}):**\n${categoryNamesList}`
        )]
    });
}
