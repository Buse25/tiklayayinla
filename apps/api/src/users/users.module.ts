import { Controller, Get, Module } from '@nestjs/common';
@Controller('users')
class UsersController { @Get('health') health() { return { module: 'users', status: 'ready' }; } }
@Module({ controllers: [UsersController] })
export class UsersModule {}
