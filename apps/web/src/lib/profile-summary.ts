import { getLatestOrganizationApplication, getOrganizationApplicationViewState, type OrganizationApplicationItem } from './organization-applications';
import { sectorLabel, type OrganizationType } from './sector';

export type ProfileRole = 'USER' | 'ADMIN' | string | null | undefined;

type ProfileOrganizationLike = {
  organizationId: string | null;
  organizationName: string | null;
  organizationType: OrganizationType | null;
  membershipRole: string | null;
  membershipStatus: string | null;
} | null | undefined;

export type ProfileLike = {
  role: ProfileRole;
  organization?: ProfileOrganizationLike;
};

export type ProfileOrganizationSummary = {
  accountStatus: string;
  organizationName: string;
  organizationType: string;
  organizationRole: string;
  applicationStatus: string;
  approvalDate: string;
};

export type ProfileNavigationLink = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

export function buildProfileOrganizationSummary(profile: ProfileLike, applications: OrganizationApplicationItem[]): ProfileOrganizationSummary {
  const latestApplication = getLatestOrganizationApplication(applications);
  const applicationState = getOrganizationApplicationViewState(applications);
  const organizationType = profile.organization?.organizationType ?? latestApplication?.organizationType ?? null;
  const organizationName = profile.organization?.organizationName ?? latestApplication?.organizationName ?? null;
  const organizationRole = profile.organization?.membershipRole ?? null;
  const accountStatus = profile.organization?.membershipStatus === 'ACTIVE'
    ? 'Aktif kurumsal hesap'
    : latestApplication
      ? applicationState.message
      : 'Kurumsal hesap yok';

  return {
    accountStatus,
    organizationName: organizationName ?? '—',
    organizationType: organizationType ? sectorLabel(organizationType) : '—',
    organizationRole: organizationRole ? organizationRoleLabel(organizationRole) : '—',
    applicationStatus: applicationState.badge,
    approvalDate: latestApplication?.status === 'APPROVED' && latestApplication.reviewedAt ? formatDate(latestApplication.reviewedAt) : '—',
  };
}

export function getProfileNavigationLinks(role: ProfileRole): ProfileNavigationLink[] {
  if (role === 'ADMIN') return [
    { href: '/admin', label: 'Panel', adminOnly: true },
    { href: '/admin/users', label: 'Kullanıcılar', adminOnly: true },
    { href: '/admin/organization-applications', label: 'Kurumsal Başvurular', adminOnly: true },
    { href: '/admin/listings', label: 'Tüm İlanlar', adminOnly: true },
    { href: '/admin/plans', label: 'Paketler', adminOnly: true },
  ];
  return [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/profile', label: 'Profil' },
    { href: '/plans', label: 'Paketler' },
    { href: '/organization-applications', label: 'Kurumsal Başvuru' },
    { href: '/activity', label: 'Aktivite' },
  ];
}

export type EidsProfileState = {
  configured: boolean;
  status: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED' | string;
  verified: boolean;
  verifiedAt: string | null;
  verificationMethod: 'EIDS' | 'ADMIN_TEST' | null;
};

export type EidsCardState = {
  message: string;
  tone: 'neutral' | 'warning' | 'success' | 'error';
  showAction: boolean;
  actionDisabled: boolean;
};

export function canStartEidsAuthorization(eids: EidsProfileState, phoneVerified: boolean, phoneVerificationMethod: 'ADMIN' | 'OTP' | null): boolean {
  return eids.configured && !eids.verified && phoneVerified && phoneVerificationMethod === 'OTP';
}

export function getEidsCardState(eids: EidsProfileState, phoneVerified: boolean, phoneVerificationMethod?: 'ADMIN' | 'OTP' | null, hasPhone = true): EidsCardState {
  if (!eids.configured) return { message: 'EİDS entegrasyonu henüz kullanıma hazır değil.', tone: 'neutral', showAction: false, actionDisabled: true };
  if (eids.status === 'PENDING') return { message: 'EİDS doğrulama işleminiz devam ediyor.', tone: 'warning', showAction: false, actionDisabled: true };
  if (eids.status === 'VERIFIED' && eids.verificationMethod === 'ADMIN_TEST') return { message: 'Test doğrulaması.', tone: 'warning', showAction: false, actionDisabled: true };
  if (eids.status === 'VERIFIED' && eids.verified && eids.verificationMethod === 'EIDS') return { message: eids.verifiedAt ? `EİDS kimlik doğrulaması tamamlandı: ${formatDate(eids.verifiedAt)}` : 'EİDS kimlik doğrulaması tamamlandı.', tone: 'success', showAction: false, actionDisabled: true };
  if (eids.status === 'FAILED') return { message: 'EİDS doğrulamanız başarısız oldu. Lütfen daha sonra tekrar deneyin.', tone: 'error', showAction: false, actionDisabled: true };
  if (!hasPhone) return { message: 'EİDS doğrulaması için önce telefon numaranızı ekleyin.', tone: 'warning', showAction: false, actionDisabled: true };
  if (!phoneVerified) return { message: 'Önce telefon numaranızı doğrulayın.', tone: 'warning', showAction: false, actionDisabled: true };
  if (phoneVerificationMethod !== 'OTP') return { message: 'EİDS doğrulaması için SMS doğrulaması gereklidir.', tone: 'warning', showAction: false, actionDisabled: true };
  return { message: 'EİDS kimlik doğrulamanızı henüz tamamlamadınız.', tone: 'neutral', showAction: true, actionDisabled: true };
}

const organizationRoleLabels: Record<string, string> = {
  OWNER: 'Yetkili',
  MANAGER: 'Yönetici',
  MEMBER: 'Üye',
};

function organizationRoleLabel(value: string) {
  return organizationRoleLabels[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
