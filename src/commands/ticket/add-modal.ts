import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import { TicketModal } from '../../database/models';
import { generateId } from '../../utils/validation';
import { successEmbed, errorEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('add-modal')
    .setDescription('Create a ticket form modal')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option
            .setName('title')
            .setDescription('Modal title')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('question-1')
            .setDescription('First question')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('question-1-type')
            .setDescription('Question type')
            .setRequired(true)
            .addChoices(
                { name: 'Short Text', value: 'SHORT' },
                { name: 'Long Text (Paragraph)', value: 'PARAGRAPH' }
            )
    )
    .addStringOption(option =>
        option
            .setName('question-2')
            .setDescription('Second question (optional)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('question-2-type')
            .setDescription('Question type')
            .setRequired(false)
            .addChoices(
                { name: 'Short Text', value: 'SHORT' },
                { name: 'Long Text (Paragraph)', value: 'PARAGRAPH' }
            )
    )
    .addStringOption(option =>
        option
            .setName('question-3')
            .setDescription('Third question (optional)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('question-3-type')
            .setDescription('Question type')
            .setRequired(false)
            .addChoices(
                { name: 'Short Text', value: 'SHORT' },
                { name: 'Long Text (Paragraph)', value: 'PARAGRAPH' }
            )
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid context')] });
        return;
    }

    const title = interaction.options.getString('title', true);

    // Build questions array
    const questions = [];

    for (let i = 1; i <= 3; i++) {
        const questionText = interaction.options.getString(`question-${i}`);
        const questionType = interaction.options.getString(`question-${i}-type`) || 'SHORT';

        if (questionText) {
            questions.push({
                id: `q${i}`,
                label: questionText,
                style: questionType as 'SHORT' | 'PARAGRAPH',
                required: true
            });
        }
    }

    if (questions.length === 0) {
        await interaction.editReply({
            embeds: [errorEmbed('At least one question is required.')]
        });
        return;
    }

    // Generate modal ID
    const modalId = generateId('modal');

    // Create modal
    await TicketModal.create({
        modalId,
        guildId: interaction.guild.id,
        title,
        questions
    });

    await interaction.editReply({
        embeds: [successEmbed(
            `Modal "${title}" created!\n\n` +
            `**ID:** \`${modalId}\`\n` +
            `**Questions:** ${questions.length}/5 (Discord limit)\n\n` +
            `Use this ID when creating categories with \`/add-category\`.`
        )]
    });
}
