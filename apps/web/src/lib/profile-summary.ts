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
    { href: '/admin/organization-applications', label: 'Kurumsal Başvurular', adminOnly: true },
    { href: '/admin/listings', label: 'Tüm İlanlar', adminOnly: true },
  ];
  return [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/profile', label: 'Profil' },
    { href: '/organization-applications', label: 'Kurumsal Başvuru' },
    { href: '/activity', label: 'Aktivite' },
  ];
}

export function getEidsInformationMessage() {
  return 'EİDS kullanıcı doğrulama altyapısı henüz yapılandırılmadı.';
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
