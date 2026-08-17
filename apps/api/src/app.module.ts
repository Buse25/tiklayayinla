import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { PortalsModule } from './portals/portals.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PublishingModule } from './publishing/publishing.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { AuditContextMiddleware } from './audit/audit-context.middleware';
import { PlansModule } from './plans/plans.module';
import { EidsModule } from './eids/eids.module';
import { SmsModule } from './sms/sms.module';

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
        SMTP_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
        SMTP_HOST: Joi.string().when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        SMTP_PORT: Joi.number().port().when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        SMTP_USER: Joi.string().when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        SMTP_PASSWORD: Joi.string().when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        SMTP_FROM_EMAIL: Joi.string().email().when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        SMTP_FROM_NAME: Joi.string().when('SMTP_ENABLED', { is: true, then: Joi.required() }),
        EIDS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
        EIDS_FIRMA_CODE: Joi.string().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_BASIC_AUTH_USERNAME: Joi.string().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_BASIC_AUTH_PASSWORD: Joi.string().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_RETURN_URL: Joi.string().uri().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_SSO_BASE_URL: Joi.string().uri().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_API_BASE_URL: Joi.string().uri().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_GET_USER_CODE_PATH: Joi.string().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_GET_USER_CODE_REQUEST_FIELD: Joi.string().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_GET_USER_CODE_RESPONSE_FIELD: Joi.string().when('EIDS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.string().allow('') }),
        EIDS_REQUEST_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
        EIDS_ALLOW_ADMIN_TEST: Joi.boolean().truthy('true').falsy('false').default(false),
        SMS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
        SMS_PROVIDER: Joi.string().allow('').default(''),
      }).unknown(true),
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule, AuditModule, RedisModule, StorageModule, MailModule, SmsModule, AuthModule, EidsModule, UsersModule, OrganizationsModule, ListingsModule, PortalsModule, PublishingModule, DashboardModule, HealthModule, PlansModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}
