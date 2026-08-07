import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer';
import { buildOrganizationApplicationApprovedMail, buildOrganizationApplicationCreatedMail, buildOrganizationApplicationRejectedMail, buildPasswordChangeCodeMail, buildTestMail, buildVerificationCodeMail } from './mail.templates';
import type { MailPayload, OrganizationApplicationMailData, PasswordChangeCodeMailData, VerificationCodeMailData } from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly enabled: boolean;
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('SMTP_ENABLED') ?? true;
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const secure = this.config.get<boolean>('SMTP_SECURE') ?? true;
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    const fromEmail = this.config.get<string>('SMTP_FROM_EMAIL');
    const fromName = this.config.get<string>('SMTP_FROM_NAME') ?? 'TıklaYayınla';

    this.fromAddress = `${fromName} <${fromEmail ?? user ?? 'no-reply@tiklayayinla.com'}>`;
    this.transporter = this.enabled
      ? createTransport({
          host,
          port,
          secure,
          auth: { user, pass: password },
        })
      : null;
  }

  async verifyTransport(): Promise<void> {
    this.ensureEnabled();
    await this.transporter!.verify();
  }

  async sendMail(payload: MailPayload): Promise<SentMessageInfo> {
    this.ensureEnabled();

    const recipients = Array.isArray(payload.to)
      ? payload.to.map(normalizeRecipient)
      : normalizeRecipient(payload.to);

    return this.transporter!.sendMail({
      from: this.fromAddress,
      to: recipients,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  }

  async sendVerificationCode(data: VerificationCodeMailData): Promise<SentMessageInfo> {
    return this.sendMail(buildVerificationCodeMail(data));
  }

  async sendPasswordChangeCode(data: PasswordChangeCodeMailData): Promise<SentMessageInfo> {
    return this.sendMail(buildPasswordChangeCodeMail(data));
  }

  async sendOrganizationApplicationCreated(data: OrganizationApplicationMailData): Promise<SentMessageInfo> {
    return this.sendMail(buildOrganizationApplicationCreatedMail(data));
  }

  async sendOrganizationApplicationApproved(data: OrganizationApplicationMailData): Promise<SentMessageInfo> {
    return this.sendMail(buildOrganizationApplicationApprovedMail(data));
  }

  async sendOrganizationApplicationRejected(data: OrganizationApplicationMailData): Promise<SentMessageInfo> {
    return this.sendMail(buildOrganizationApplicationRejectedMail(data));
  }

  async sendTestMail(to: string): Promise<SentMessageInfo> {
    return this.sendMail(buildTestMail(to));
  }

  private ensureEnabled(): void {
    if (!this.enabled || !this.transporter) {
      this.logger.warn('SMTP is disabled.');
      throw new ServiceUnavailableException('SMTP altyapısı etkin değil.');
    }
  }
}

function normalizeRecipient(recipient: string | { email: string; name?: string }) {
  if (typeof recipient === 'string') {
    return recipient;
  }

  return {
    address: recipient.email,
    name: recipient.name ?? '',
  };
}
