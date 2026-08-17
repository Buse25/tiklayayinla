import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Bu isimde bir paket zaten bulunuyor.');
    }
    return this.prisma.plan.create({ data: dto });
  }

  async findAllActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.plan.findMany({
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Paket bulunamadı.');
    }
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id);
    if (dto.name) {
      const existing = await this.prisma.plan.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('Bu isimde başka bir paket zaten bulunuyor.');
      }
    }
    return this.prisma.plan.update({
      where: { id },
      data: dto,
    });
  }

  async removeSoft(id: string) {
    await this.findOne(id);
    return this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async selectPlan(userId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Seçilen paket bulunamadı.');
    }
    if (!plan.isActive) {
      throw new BadRequestException('Bu paket şu anda aktif değil.');
    }

    const existing = await this.prisma.subscription.findFirst({
      where: { userId },
    });

    if (existing) {
      return this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: 'PENDING_PAYMENT',
          startsAt: new Date(),
          expiresAt: null,
        },
        include: { plan: true },
      });
    }

    return this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'PENDING_PAYMENT',
        startsAt: new Date(),
        expiresAt: null,
      },
      include: { plan: true },
    });
  }
}
