import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserService } from '@/modules/user/services/user.service';
import { UsersController } from '@/modules/user/controllers/users.controller';
import { UserUoW } from '@/modules/user/user.uow';
import { BillingListener } from '@/modules/user/listeners/billing.listener';
import { EventOutboxModule } from '@/modules/event-outbox/event-outbox.module';
import { UserOutboxRelay } from '@/modules/user/services/user-outbox-relay.service';

@Module({
  imports: [EventEmitterModule, PrismaModule, EventOutboxModule],
  controllers: [UsersController],
  providers: [UserService, UserUoW, BillingListener, UserOutboxRelay],
  exports: [UserService],
})
export class UserModule {}
