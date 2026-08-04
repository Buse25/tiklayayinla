import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { PortalsModule } from './portals/portals.module';
import { PublishingModule } from './publishing/publishing.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_TTL: Joi.string().pattern(/^\d+(ms|s|m|h|d)$/).required(),
        JWT_REFRESH_TTL: Joi.string().pattern(/^\d+(ms|s|m|h|d)$/).required(),
        PORTAL_CREDENTIALS_KEY: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).required(),
        RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
        PORT: Joi.number().port().required(),
      }).unknown(true),
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule, RedisModule, StorageModule, AuthModule, UsersModule, ListingsModule, PortalsModule, PublishingModule, DashboardModule, HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
