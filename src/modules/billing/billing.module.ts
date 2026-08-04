import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { BillingService } from './services/billing.service';
import { BillingController } from './controllers/billing.controller';
import { AddonController } from './controllers/addon.controller';
import { PublicPlanController } from './controllers/public-plan.controller';
import { PublicAddonController } from './controllers/public-addon.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { BillingScheduler } from './services/billing.scheduler';

import { InvoicePaidListener } from './listeners/invoice-paid.listener';
import { InvoicePaymentFailedListener } from './listeners/invoice-payment-failed.listener';
import { SubscriptionDeletedListener } from './listeners/subscription-deleted.listener';
import { PaymentIntentSucceededListener } from './listeners/payment-intent-succeeded.listener';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    PaymentModule,
  ],
  controllers: [
    BillingController,
    AddonController,
    PublicPlanController,
    PublicAddonController,
    SubscriptionController,
  ],
  providers: [
    BillingService,
    BillingScheduler,
    InvoicePaidListener,
    InvoicePaymentFailedListener,
    SubscriptionDeletedListener,
    PaymentIntentSucceededListener,
  ],
  exports: [BillingService],
})
export class BillingModule {}
