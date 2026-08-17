import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER, UnconfiguredSmsProvider } from './sms.provider';
import { SmsService } from './sms.service';

@Module({
  providers: [
    { provide: SMS_PROVIDER, inject: [ConfigService], useFactory: (config: ConfigService) => {
      // Real providers will be added behind this abstraction later.
      return config.get<string>('SMS_ENABLED') === 'true' && config.get<string>('SMS_PROVIDER') === 'TEST' ? new UnconfiguredSmsProvider() : new UnconfiguredSmsProvider();
    } },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
