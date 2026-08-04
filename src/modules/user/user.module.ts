import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserService } from '@/modules/user/services/user.service';
import { UsersController } from '@/modules/user/controllers/users.controller';

@Module({
  imports: [EventEmitterModule, PrismaModule],
  controllers: [UsersController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
