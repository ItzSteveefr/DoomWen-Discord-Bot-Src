import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { EmbedConfig, FormResponse } from '../types';

// Professional, Modern Color Palette
export const Colors = {
    // Main Brand Colors
    PRIMARY: '#5865F2' as ColorResolvable,   // Discord Blurple - Clean & Native feel
    SECONDARY: '#2B2D31' as ColorResolvable, // Dark theme background
    ACCENT: '#EB459E' as ColorResolvable,    // Fuchsia for highlights

    // Status Colors
    SUCCESS: '#43B581' as ColorResolvable,   // Muted Green
    WARNING: '#FAA61A' as ColorResolvable,   // Warm Orange
    ERROR: '#F04747' as ColorResolvable,     // Soft Red
    INFO: '#00B0F4' as ColorResolvable,      // Sky Blue

    // State Colors
    PENDING: '#7289DA' as ColorResolvable,
    ACTIVE: '#43B581' as ColorResolvable,
    COMPLETED: '#FAA61A' as ColorResolvable,
};

const FOOTER_TEXT = 'Doom Wen • Automated System';

/**
 * Build an embed from config stored in DB
 * Enhanced to look more premium even with basic config
 */
export function buildEmbedFromConfig(embedConfig: EmbedConfig): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (embedConfig.title) embed.setTitle(embedConfig.title);
    if (embedConfig.description) embed.setDescription(embedConfig.description);

    // Use config color or fallback to Primary
    embed.setColor((embedConfig.color as ColorResolvable) || Colors.PRIMARY);

    if (embedConfig.thumbnail) embed.setThumbnail(embedConfig.thumbnail);
    if (embedConfig.image) embed.setImage(embedConfig.image);

    // Ensure footer exists
    embed.setFooter({ text: embedConfig.footer || FOOTER_TEXT });

    if (embedConfig.fields && embedConfig.fields.length > 0) {
        embedConfig.fields.forEach(field => {
            embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline ?? false
            });
        });
    }

    return embed;
}

/**
 * Create a ticket info embed with form responses
 * Styled like a professional dossier/file
 */
export function createTicketInfoEmbed(
    userId: string,
    categoryName: string,
    formResponses: FormResponse[],
    userAvatarUrl?: string
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`Ticket: ${categoryName}`)
        .setColor(Colors.PRIMARY)
        .setDescription(`Ticket created by <@${userId}>. Support will be with you shortly.`)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

    // Use user's avatar if provided
    if (userAvatarUrl) {
        embed.setThumbnail(userAvatarUrl);
    }

    if (formResponses.length > 0) {
        // Add a separator field for visual spacing
        embed.addFields({ name: '\u200b', value: '**Form Details**', inline: false });

        formResponses.forEach(response => {
            // Format questions as bold headers
            embed.addFields({
                name: response.question,
                value: `\`\`\`${response.answer || 'No response'}\`\`\``,
                inline: false
            });
        });
    }

    return embed;
}

/**
 * Create a success embed
 * Clean, minimal, positive
 */
export function successEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setDescription(`**Success**\n${message}`);
    // No footer for simple success messages to keep them ephemeral-clean
}

/**
 * Create an error embed
 * Clean, warning style
 */
export function errorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setDescription(`**Error**\n${message}`);
}

/**
 * Create an info embed
 */
export function infoEmbed(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(title)
        .setDescription(message)
        .setFooter({ text: FOOTER_TEXT });
}

/**
 * Create a commission status embed
 * Rich status display with financial styling
 */
export function commissionStatusEmbed(
    freelancerId: string | undefined,
    price: string | undefined,
    deadline: string | undefined,
    status: string
): EmbedBuilder {
    // Determine color based on status string content
    let color = Colors.PRIMARY;
    if (status.includes('ACTIVE')) color = Colors.ACTIVE;
    if (status.includes('PENDING')) color = Colors.PENDING;
    if (status.includes('COMPLETED')) color = Colors.COMPLETED;
    if (status.includes('CANCELLED')) color = Colors.ERROR;

    const embed = new EmbedBuilder()
        .setTitle('Commission Dashboard')
        .setColor(color)
        .setDescription(`**Current Status**\n\`${status}\``)
        .addFields(
            {
                name: 'Freelancer',
                value: freelancerId ? `<@${freelancerId}>` : 'Waiting for assignment...',
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

    // Add decorative fields for financial details
    if (price || deadline) {
        embed.addFields({ name: '\u200b', value: '\u200b', inline: false }); // Spacer

        if (price) {
            embed.addFields({
                name: 'Price',
                value: `\`${price}\``,
                inline: true
            });
        }

        if (deadline) {
            embed.addFields({
                name: 'Deadline',
                value: `\`${deadline}\``,
                inline: true
            });
        }
    }

    return embed;
}

/**
 * Create a transcript generated embed
 */
export function transcriptEmbed(ticketName: string, transcriptUrl: string): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('Ticket Archived')
        .setColor(Colors.SECONDARY)
        .setDescription(`The ticket **${ticketName}** has been closed and archived.`)
        .addFields({
            name: 'Transcript',
            value: `[**Click here to view transcript**](${transcriptUrl})`
        })
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}
