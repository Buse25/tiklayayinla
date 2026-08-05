import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { AuditAction, AuditEntityType, MembershipStatus, Prisma } from '@prisma/client';
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
    return toProfileResponse(profile);
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto): Promise<MyProfileResponseDto> {
    const profile = await this.prisma.user.update({ where: { id: userId }, data: dto, select: profileSelect });
    if (Object.keys(dto).length) await this.audit.log({ actorUserId: userId, action: AuditAction.USER_PROFILE_UPDATED, entityType: AuditEntityType.USER, entityId: userId, changes: { changedFields: Object.keys(dto) } });
    return toProfileResponse(profile);
  }
}

type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

function toProfileResponse(profile: ProfileRecord): MyProfileResponseDto {
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
  };
}
