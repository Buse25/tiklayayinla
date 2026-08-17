import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { EmailVerificationService } from './email-verification.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SmsModule } from '../sms/sms.module';
import { PhoneVerificationService } from './phone-verification.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule, SmsModule],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, PhoneVerificationService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
