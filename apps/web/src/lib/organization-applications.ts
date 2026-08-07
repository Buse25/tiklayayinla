import type { OrganizationType } from './sector';

export type OrganizationApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type OrganizationApplicationItem = {
  id: string;
  userId: string;
  organizationName: string;
  organizationType: OrganizationType;
  country?: string;
  city: string;
  district: string;
  taxOffice?: string | null;
  vkn?: string | null;
  authorizedPersonName?: string;
  companyPhone?: string | null;
  businessEmail?: string | null;
  address?: string;
  licenseNumber?: string | null;
  status: OrganizationApplicationStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewedAt: string | null;
  reviewedById?: string | null;
};

export type OrganizationApplicationViewState =
  | { kind: 'none'; badge: 'Başvur'; message: string }
  | { kind: 'pending'; badge: 'İncelemede'; message: string }
  | { kind: 'approved'; badge: 'Onaylandı'; message: string }
  | { kind: 'rejected'; badge: 'Reddedildi'; message: string; rejectionReason: string };

export type OrganizationLicenseRequirement = {
  visible: boolean;
  required: boolean;
  label: string;
};

export function getLatestOrganizationApplication(applications: OrganizationApplicationItem[]): OrganizationApplicationItem | null {
  if (!applications.length) return null;
  return [...applications].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
}

export function getOrganizationApplicationViewState(applications: OrganizationApplicationItem[]): OrganizationApplicationViewState {
  const latest = getLatestOrganizationApplication(applications);
  if (!latest) return { kind: 'none', badge: 'Başvur', message: 'Henüz kurumsal başvuru yok.' };
  if (latest.status === 'PENDING') return { kind: 'pending', badge: 'İncelemede', message: 'Kurumsal başvurunuz incelemede.' };
  if (latest.status === 'APPROVED') return { kind: 'approved', badge: 'Onaylandı', message: 'Kurumsal hesabınız onaylandı.' };
  return {
    kind: 'rejected',
    badge: 'Reddedildi',
    message: 'Kurumsal başvurunuz reddedildi.',
    rejectionReason: latest.rejectionReason?.trim() || 'Başvurunuz reddedildi.',
  };
}

export function getOrganizationApplicationStatusBadge(status: OrganizationApplicationStatus | null | undefined): string {
  if (!status) return 'Başvur';
  if (status === 'PENDING') return 'İncelemede';
  if (status === 'APPROVED') return 'Onaylandı';
  return 'Reddedildi';
}

export function getLicenseNumberRequirement(organizationType: OrganizationType): OrganizationLicenseRequirement {
  if (organizationType === 'AUTO_DEALER') {
    return {
      visible: true,
      required: true,
      label: 'Motorlu Kara Taşıtı Ticareti Yetki Belge No',
    };
  }

  return {
    visible: false,
    required: false,
    label: 'Yetki belge no',
  };
}

export function normalizeApplicationLicenseNumber(organizationType: OrganizationType, licenseNumber: string): string | undefined {
  if (organizationType !== 'AUTO_DEALER') return undefined;
  const normalized = licenseNumber.trim();
  return normalized.length ? normalized : undefined;
}
