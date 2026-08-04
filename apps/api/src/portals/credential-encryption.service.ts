import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CredentialEncryptionService {
  private readonly key = this.loadKey();

  encrypt(credentials: Record<string, unknown>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  decrypt(payload: string): Record<string, unknown> {
    try {
      const [version, iv, authTag, ciphertext] = payload.split('.');
      if (version !== 'v1' || !iv || !authTag || !ciphertext) throw new Error('Invalid encrypted payload.');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')) as Record<string, unknown>;
    } catch { throw new InternalServerErrorException('Portal credential bilgisi çözülemedi.'); }
  }

  private loadKey(): Buffer {
    const value = process.env.PORTAL_CREDENTIALS_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('PORTAL_CREDENTIALS_KEY must be a 64-character hexadecimal AES-256 key.');
    return Buffer.from(value, 'hex');
  }
}
