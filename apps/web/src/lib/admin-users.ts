export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  phoneVerificationMethod: 'ADMIN' | 'OTP' | null;
  role: string;
  status: string;
  createdAt: string;
  latestApplicationStatus: string | null;
  organization: { id: string; name: string; type: string; membershipStatus: string } | null;
  eidsStatus: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  eidsVerificationMethod: 'EIDS' | 'ADMIN_TEST' | null;
  eidsVerifiedAt: string | null;
};

export function verificationLabel(verified: boolean) {
  return verified ? 'Doğrulandı' : 'Doğrulanmadı';
}

export function canManuallyVerifyPhone(user: Pick<AdminUser, 'phone' | 'phoneVerified'>) {
  return Boolean(user.phone && !user.phoneVerified);
}

export function phoneVerificationMethodLabel(method: AdminUser['phoneVerificationMethod']) {
  if (method === 'ADMIN') return 'Admin';
  if (method === 'OTP') return 'SMS OTP';
  return '—';
}
