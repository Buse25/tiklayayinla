import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { AuditAction, AuditEntityType, MembershipStatus, OrganizationApplicationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

const profileSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true,
  role: true, status: true, createdAt: true, updatedAt: true,
  organizationMemberships: {
    where: { status: MembershipStatus.ACTIVE },
    orderBy: { createdAt: 'asc' },
    take: 1,
    include: { organization: { select: { id: true, name: true, type: true } } },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async getMyProfile(userId: string): Promise<MyProfileResponseDto> {
    const profile = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect });
    const latestApp = await this.prisma.organizationApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return toProfileResponse(profile, latestApp?.status ?? null);
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto): Promise<MyProfileResponseDto> {
    const profile = await this.prisma.user.update({ where: { id: userId }, data: dto, select: profileSelect });
    if (Object.keys(dto).length) await this.audit.log({ actorUserId: userId, action: AuditAction.USER_PROFILE_UPDATED, entityType: AuditEntityType.USER, entityId: userId, changes: { changedFields: Object.keys(dto) } });
    const latestApp = await this.prisma.organizationApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    return toProfileResponse(profile, latestApp?.status ?? null);
  }
}

type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

function toProfileResponse(profile: ProfileRecord, applicationStatus?: OrganizationApplicationStatus | null): MyProfileResponseDto {
  const membership = profile.organizationMemberships[0];
  const { organizationMemberships, ...user } = profile;
  return {
    ...user,
    organization: membership ? {
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      organizationType: membership.organization.type,
      membershipRole: membership.role,
      membershipStatus: membership.status,
    } : { organizationId: null, organizationName: null, organizationType: null, membershipRole: null, membershipStatus: null },
    organizationApplicationStatus: applicationStatus ?? null,
  };
}
