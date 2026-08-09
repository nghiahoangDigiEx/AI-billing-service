import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '@/prisma/prisma.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { UserModule } from '@/modules/user/user.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BillingModule } from '@/modules/billing/billing.module';
import { StripeModule } from '@/modules/stripe/stripe.module';
import { CreditModule } from '@/modules/credit/credit.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { LoggerModule } from '@/common/logger/logger.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      global: true,
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    BillingModule,
    StripeModule,
    CreditModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
