import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SMS_PROVIDER, type SmsProvider } from './sms.provider';

@Injectable()
export class SmsService {
  constructor(@Inject(SMS_PROVIDER) private readonly provider: SmsProvider) {}
  async sendVerificationCode(phone: string, code: string, expiresAt: Date): Promise<void> {
    if (!this.provider.isConfigured()) throw new ServiceUnavailableException('SMS provider yapılandırılmamış.');
    await this.provider.sendVerificationCode(phone, code, expiresAt);
  }
}
