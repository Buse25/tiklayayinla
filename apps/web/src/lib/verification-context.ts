const STORAGE_KEY = 'tiklayayinla_email_verification_context';

export type StoredVerificationContext = {
  email: string;
  verificationContext?: string;
  expiresAt?: string | null;
  resendAvailableAt?: string | null;
  mailDeliveryFailed?: boolean;
};

export function saveVerificationContext(value: StoredVerificationContext): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function readVerificationContext(): StoredVerificationContext | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredVerificationContext;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearVerificationContext(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

