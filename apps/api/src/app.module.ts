import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { PortalsModule } from './portals/portals.module';
import { PublishingModule } from './publishing/publishing.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule, StorageModule, AuthModule, UsersModule, ListingsModule, PortalsModule, PublishingModule,
  ],
})
export class AppModule {}
