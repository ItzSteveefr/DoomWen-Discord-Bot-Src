import { ColorResolvable, APIEmbed } from 'discord.js';

// Embed configuration stored in DB
export interface EmbedConfig {
    title?: string;
    description?: string;
    color?: string;
    thumbnail?: string;
    image?: string;
    footer?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
}

// Modal question configuration
export interface ModalQuestion {
    id: string;
    label: string;
    placeholder?: string;
    style: 'SHORT' | 'PARAGRAPH';
    required: boolean;
    minLength?: number;
    maxLength?: number;
}

// Form response from user
export interface FormResponse {
    questionId: string;
    question: string;
    answer: string;
}

// Reaction role mapping
export interface RoleMapping {
    emoji: string;
    roleId: string;
}

// Command module interface
export interface CommandModule {
    data: any; // SlashCommandBuilder
    execute: (interaction: any) => Promise<void>;
}

// Button ID structure
export interface ParsedButtonId {
    action: string;
    params: Record<string, string>;
}

// Utility to build button IDs
export function buildButtonId(action: string, params: Record<string, string> = {}): string {
    const paramStr = Object.entries(params)
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
    return paramStr ? `${action}|${paramStr}` : action;
}

// Utility to parse button IDs
export function parseButtonId(customId: string): ParsedButtonId {
    const parts = customId.split('|');
    const action = parts[0];
    const params: Record<string, string> = {};

    for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split(':');
        if (key && value) {
            params[key] = value;
        }
    }

    return { action, params };
}
