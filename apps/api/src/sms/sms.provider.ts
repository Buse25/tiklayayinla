import { ServiceUnavailableException } from '@nestjs/common';

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  isConfigured(): boolean;
  sendVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void>;
}

export class UnconfiguredSmsProvider implements SmsProvider {
  isConfigured(): boolean { return false; }
  async sendVerificationCode(): Promise<void> { throw new ServiceUnavailableException('SMS provider yapılandırılmamış.'); }
}

export class TestSmsProvider implements SmsProvider {
  readonly sentCodes: Array<{ phone: string; code: string; expiresAt: Date }> = [];
  isConfigured(): boolean { return true; }
  async sendVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void> { this.sentCodes.push({ phone, code, expiresAt }); }
}
