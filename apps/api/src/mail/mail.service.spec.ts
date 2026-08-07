import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const verifyMock = jest.fn();
const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: verifyMock,
    sendMail: sendMailMock,
  })),
}));

describe('MailService', () => {
  beforeEach(() => {
    verifyMock.mockReset();
    sendMailMock.mockReset();
    process.env.SMTP_ENABLED = 'true';
  });

  it('verifies the transport and sends a test mail', async () => {
    const service = new MailService(mockConfig());
    verifyMock.mockResolvedValue(undefined);
    sendMailMock.mockResolvedValue({ messageId: 'message-id' });

    await service.verifyTransport();
    await service.sendTestMail('test@example.com');

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.com',
      subject: expect.stringContaining('SMTP test e-postası'),
    }));
  });
});

function mockConfig(): ConfigService {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        SMTP_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 465,
        SMTP_SECURE: true,
        SMTP_USER: 'no-reply@example.com',
        SMTP_PASSWORD: 'secret',
        SMTP_FROM_EMAIL: 'no-reply@example.com',
        SMTP_FROM_NAME: 'TıklaYayınla',
      };
      return values[key];
    }),
  } as unknown as ConfigService;
}

