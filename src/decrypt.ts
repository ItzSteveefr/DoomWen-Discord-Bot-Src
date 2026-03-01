import crypto from 'crypto';
import https from 'https';
import http from 'http';

let cachedKey: Buffer | null = null;

function fetchMasterKey(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const url = process.env.MASTER_KEY_URL;
        if (!url) {
            return reject(new Error('MASTER_KEY_URL is not defined in environment variables.'));
        }

        const client = url.startsWith('http:') ? http : https;

        if (url.startsWith('http:')) {
            console.warn('[SECURITY WARNING] Fetching master key over HTTP. This is unsafe for production!');
        }

        const req = client.get(url, { timeout: 5000 }, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch master key: HTTP ${res.statusCode}`));
            }

            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                const keyHex = data.trim();
                if (keyHex.length !== 64) {
                    return reject(new Error('Invalid master key length. Expected 64 hex characters.'));
                }
                resolve(Buffer.from(keyHex, 'hex'));
            });
        });

        req.on('error', (err) => reject(new Error(`Network error fetching master key: ${err.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout fetching master key (5000ms).'));
        });
    });
}

export async function initDecryptor(): Promise<void> {
    if (cachedKey) return; // Already loaded

    console.log('[Decryptor] Fetching master key...');
    try {
        cachedKey = await fetchMasterKey();
        console.log('[Decryptor] Master key loaded successfully (memory only).');
    } catch (error: any) {
        console.error('[CRITICAL] Failed to initialize decryptor:', error.message);
        process.exit(1);
    }
}

export function decryptSecret(encryptedHex: string): string {
    if (!cachedKey) {
        throw new Error('Decryptor not initialized. Call initDecryptor() first.');
    }

    try {
        // Pass through if not encrypted
        if (!encryptedHex.includes(':')) return encryptedHex;

        const parts = encryptedHex.split(':');
        if (parts.length !== 3) {
            return encryptedHex; // Assume not encrypted if format doesn't match
        }

        const [ivHex, authTagHex, encryptedTextHex] = parts;

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encryptedText = Buffer.from(encryptedTextHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', cachedKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error: any) {
        console.error(`Decryption failed: ${error.message}`);
        throw error;
    }
}