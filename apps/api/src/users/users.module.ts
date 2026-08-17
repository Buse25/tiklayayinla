import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { EidsModule } from '../eids/eids.module';

@Module({ imports: [MailModule, EidsModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
