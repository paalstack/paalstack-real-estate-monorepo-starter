// Users module — user-creation hierarchy.
// POST /api/users  ADMIN → any role; MANAGER → staff in own team
// GET  /api/users  ADMIN → all; MANAGER → own team; staff → self
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
