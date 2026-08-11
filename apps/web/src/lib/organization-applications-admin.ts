import { getLicenseNumberRequirement } from './organization-applications';
import { sectorLabel, type OrganizationType } from './sector';

export type OrganizationApplicationStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type OrganizationApplicationTab = 'ALL' | OrganizationApplicationStatus;

export type OrganizationApplicationAdminItem = {
  id: string;
  userId: string;
  organizationName: string;
  organizationType: OrganizationType;
  country: string;
  city: string;
  district: string;
  taxOffice?: string | null;
  vkn?: string | null;
  authorizedPersonName: string;
  companyPhone?: string | null;
  businessEmail?: string | null;
  address: string;
  licenseNumber?: string | null;
  status: OrganizationApplicationStatus;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationApplicationAdminReviewResponse = OrganizationApplicationAdminItem & {
  organization?: { id: string; name: string; type: OrganizationType } | null;
};

const statusLabels: Record<OrganizationApplicationStatus, string> = {
  PENDING: 'Bekleyen',
  APPROVED: 'Onaylanan',
  SUSPENDED: 'Askıya alınan',
  REJECTED: 'Reddedilen',
};

const statusTones: Record<OrganizationApplicationStatus, string> = {
  PENDING: 'amber',
  APPROVED: 'emerald',
  SUSPENDED: 'amber',
  REJECTED: 'rose',
};

export function canApproveOrganizationApplication(status: OrganizationApplicationStatus) {
  return status === 'PENDING';
}

export function canRejectOrganizationApplication(status: OrganizationApplicationStatus) {
  return ['PENDING', 'APPROVED', 'SUSPENDED'].includes(status);
}

export function maskOrganizationVkn(vkn: string | null | undefined) {
  if (!vkn) return '—';
  const digits = vkn.replace(/\s+/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function getOrganizationApplicationStatusLabel(status: OrganizationApplicationStatus) {
  return statusLabels[status];
}

export function getOrganizationApplicationStatusTone(status: OrganizationApplicationStatus) {
  return statusTones[status];
}

export function getOrganizationApplicationSectorLabel(item: Pick<OrganizationApplicationAdminItem, 'organizationType'>) {
  return sectorLabel(item.organizationType);
}

export function getOrganizationApplicationLicenseRequirement(organizationType: OrganizationType) {
  return getLicenseNumberRequirement(organizationType);
}

export function validateRejectionReason(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'Red nedeni zorunludur.';
  if (trimmed.length < 10) return 'Red nedeni en az 10 karakter olmalıdır.';
  return null;
}

export function filterOrganizationApplications(applications: OrganizationApplicationAdminItem[], tab: OrganizationApplicationTab) {
  if (tab === 'ALL') return applications;
  return applications.filter((application) => application.status === tab);
}

export function countOrganizationApplications(applications: OrganizationApplicationAdminItem[]) {
  return applications.reduce<Record<OrganizationApplicationTab, number>>((counts, application) => {
    counts.ALL += 1;
    counts[application.status] += 1;
    return counts;
  }, { ALL: 0, PENDING: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0 });
}
