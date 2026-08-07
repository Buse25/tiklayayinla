import type { MailPayload, OrganizationApplicationMailData, VerificationCodeMailData } from './mail.types';

const brandName = 'TıklaYayınla';

export function buildVerificationCodeMail(data: VerificationCodeMailData): MailPayload {
  return {
    to: data.to,
    subject: `${brandName} e-posta doğrulama kodunuz`,
    text: [
      `${brandName} e-posta doğrulama kodunuz`,
      '',
      `Doğrulama kodunuz: ${data.code}`,
      `Bu kod ${minutesBetween(data.expiresAt, new Date())} dakika boyunca geçerlidir.`,
      `Kodunuzu siz istemediyseniz lütfen bu e-postayı dikkate almayın.`,
    ].join('\n'),
    html: baseHtml(
      `${brandName} e-posta doğrulama kodunuz`,
      `
        <p style="margin:0 0 16px">Doğrulama kodunuz:</p>
        <div style="display:inline-block;padding:16px 20px;border:1px solid #d1d5db;border-radius:14px;font-size:28px;font-weight:700;letter-spacing:0.2em;background:#f8fafc">${data.code}</div>
        <p style="margin:16px 0 0">Bu kod 10 dakika geçerlidir. Kod talebi sizden gelmediyse lütfen dikkate almayın.</p>
      `,
    ),
  };
}

export function buildOrganizationApplicationCreatedMail(data: OrganizationApplicationMailData): MailPayload {
  return organizationTemplate({
    to: data.to,
    subject: 'Kurumsal başvurunuz alındı',
    title: 'Kurumsal başvurunuz alındı',
    paragraphs: [
      `${data.userName ? `${data.userName}, ` : ''}${data.organizationName} için başvurunuz alınmıştır.`,
      'Başvurunuz incelendikten sonra size tekrar bilgi vereceğiz.',
    ],
  });
}

export function buildOrganizationApplicationApprovedMail(data: OrganizationApplicationMailData): MailPayload {
  return organizationTemplate({
    to: data.to,
    subject: 'Kurumsal hesabınız onaylandı',
    title: 'Kurumsal hesabınız onaylandı',
    paragraphs: [
      `${data.userName ? `${data.userName}, ` : ''}${data.organizationName} için kurumsal hesabınız onaylandı.`,
      'Artık kurumsal hesabınızı aktif olarak kullanabilirsiniz.',
    ],
  });
}

export function buildOrganizationApplicationRejectedMail(data: OrganizationApplicationMailData): MailPayload {
  return organizationTemplate({
    to: data.to,
    subject: 'Kurumsal başvurunuz reddedildi',
    title: 'Kurumsal başvurunuz reddedildi',
    paragraphs: [
      `${data.userName ? `${data.userName}, ` : ''}${data.organizationName} için başvurunuz reddedildi.`,
      data.rejectionReason ? `Red nedeni: ${data.rejectionReason}` : 'Başvurunuz tekrar incelenmek üzere yeniden gönderilebilir.',
    ],
  });
}

export function buildTestMail(to: string): MailPayload {
  return {
    to,
    subject: `${brandName} SMTP test e-postası`,
    text: 'Bu bir test e-postasıdır. SMTP bağlantısı başarılıdır.',
    html: baseHtml('SMTP test e-postası', '<p>Bu bir test e-postasıdır. SMTP bağlantısı başarılıdır.</p>'),
  };
}

function organizationTemplate(input: { to: string; subject: string; title: string; paragraphs: string[] }): MailPayload {
  return {
    to: input.to,
    subject: `${brandName} - ${input.subject}`,
    text: [input.title, '', ...input.paragraphs].join('\n'),
    html: baseHtml(input.title, input.paragraphs.map((paragraph) => `<p style="margin:0 0 12px">${escapeHtml(paragraph)}</p>`).join('')),
  };
}

function baseHtml(title: string, body: string): string {
  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;padding:28px">
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3">${escapeHtml(title)}</h1>
          <div style="font-size:16px;line-height:1.7">${body}</div>
        </div>
      </div>
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.max(1, Math.round((later.getTime() - earlier.getTime()) / 60_000));
}

