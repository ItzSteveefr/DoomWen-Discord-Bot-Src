import { TextChannel, AttachmentBuilder } from 'discord.js';
import * as transcripts from 'discord-html-transcripts';
import { config, isGitHubConfigured } from '../config/env';
import fetch from 'node-fetch';
import { initDecryptor, decryptSecret } from '../decrypt';

interface TranscriptResult {
    success: boolean;
    url: string;
    error?: string;
}

export class TranscriptService {

    /**
     * Generate HTML transcript and upload to GitHub Pages
     */
    async generateAndUpload(
        channel: TextChannel,
        ticketId: string
    ): Promise<TranscriptResult> {
        try {
            // Generate HTML transcript as attachment
            const attachment = await transcripts.createTranscript(channel, {
                limit: -1, // No limit
                filename: `${ticketId}.html`,
                saveImages: true,
                poweredBy: false,
            });

            // Get the attachment data and convert to base64
            const attachmentData = attachment.attachment;
            let base64Content: string;

            if (Buffer.isBuffer(attachmentData)) {
                base64Content = attachmentData.toString('base64');
            } else if (typeof attachmentData === 'string') {
                // Read file path
                const fs = await import('fs/promises');
                const fileBuffer = await fs.readFile(attachmentData);
                base64Content = fileBuffer.toString('base64');
            } else {
                // It's a stream - use a promise-based approach
                const streamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> => {
                    return new Promise((resolve, reject) => {
                        const chunks: Buffer[] = [];
                        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                        stream.on('error', reject);
                        stream.on('end', () => resolve(Buffer.concat(chunks)));
                    });
                };
                const buffer = await streamToBuffer(attachmentData as unknown as NodeJS.ReadableStream);
                base64Content = buffer.toString('base64');
            }

            // Check if GitHub is configured
            if (!isGitHubConfigured()) {
                console.warn('GitHub not configured - transcripts will use attachment fallback');
                return {
                    success: true,
                    url: `attachment://${ticketId}.html`,
                    error: 'GitHub not configured, using attachment fallback'
                };
            }

            // Upload to GitHub
            const uploadResult = await this.uploadToGitHub(
                `transcripts/${ticketId}.html`,
                base64Content
            );

            if (!uploadResult.success) {
                // Fallback: return as attachment (we'll handle this in the close flow)
                console.error('GitHub upload failed:', uploadResult.error);
                return {
                    success: true,
                    url: `attachment://${ticketId}.html`,
                    error: 'GitHub upload failed, using attachment fallback'
                };
            }

            return {
                success: true,
                url: `${config.github.baseUrl}/transcripts/${ticketId}.html`
            };
        } catch (error) {
            console.error('Error generating transcript:', error);
            return {
                success: false,
                url: '',
                error: 'Failed to generate transcript'
            };
        }
    }

    /**
     * Upload file to GitHub repository
     */
    private async uploadToGitHub(
        filePath: string,
        base64Content: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const token = config.github;
            const { repo, branch } = config.github;

            if (!token || !repo) {
                return { success: false, error: 'GitHub configuration missing' };
            }

            const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

            // Check if file exists (to get SHA for update)
            let sha: string | undefined;
            try {
                const checkResponse = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                });
                if (checkResponse.ok) {
                    const data = await checkResponse.json() as { sha: string };
                    sha = data.sha;
                }
            } catch {
                // File doesn't exist, that's fine
            }

            // Create or update file
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Add transcript ${filePath}`,
                    content: base64Content,
                    branch,
                    ...(sha ? { sha } : {}),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub API error:', response.status, errorText);
                return { success: false, error: `GitHub API error: ${response.status}` };
            }

            return { success: true };
        } catch (error) {
            console.error('GitHub upload error:', error);
            return { success: false, error: 'GitHub upload failed' };
        }
    }

    /**
     * Generate transcript as attachment (fallback)
     */
    async generateAttachment(
        channel: TextChannel,
        ticketId: string
    ): Promise<AttachmentBuilder> {
        return transcripts.createTranscript(channel, {
            limit: -1,
            filename: `${ticketId}.html`,
            saveImages: true,
            poweredBy: false,
        });
    }
}
