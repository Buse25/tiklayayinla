import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';

const profileSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true,
  role: true, status: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string): Promise<MyProfileResponseDto> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect });
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto): Promise<MyProfileResponseDto> {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: profileSelect });
  }
}
