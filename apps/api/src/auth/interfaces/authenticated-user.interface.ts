import type { MembershipStatus, OrganizationRole, OrganizationType, UserRole, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    membershipRole: OrganizationRole;
    membershipStatus: MembershipStatus;
  } | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationType: OrganizationType | null;
  membershipRole: OrganizationRole | null;
  membershipStatus: MembershipStatus | null;
}
