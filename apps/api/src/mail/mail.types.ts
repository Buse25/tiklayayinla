export type MailRecipient = string | { email: string; name?: string };

export type MailPayload = {
  to: MailRecipient | MailRecipient[];
  subject: string;
  html: string;
  text: string;
};

export type VerificationCodeMailData = {
  to: string;
  code: string;
  expiresAt: Date;
  resendAvailableAt: Date;
};

export type OrganizationApplicationMailData = {
  to: string;
  organizationName: string;
  userName?: string;
  rejectionReason?: string | null;
};

