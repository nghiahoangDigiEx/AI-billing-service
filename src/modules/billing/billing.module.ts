import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@/prisma/prisma.module';
import { PaymentModule } from '@/modules/payment/payment.module';
import { EventOutboxModule } from '@/modules/event-outbox/event-outbox.module';
import { BillingService } from '@/modules/billing/services/billing.service';
import { BillingController } from '@/modules/billing/controllers/billing.controller';
import { AddonController } from '@/modules/billing/controllers/addon.controller';
import { PublicPlanController } from '@/modules/billing/controllers/public-plan.controller';
import { PublicAddonController } from '@/modules/billing/controllers/public-addon.controller';
import { SubscriptionController } from '@/modules/billing/controllers/subscription.controller';
import { BillingScheduler } from '@/modules/billing/services/billing.scheduler';

import { InvoicePaidListener } from '@/modules/billing/listeners/invoice-paid.listener';
import { InvoicePaymentFailedListener } from '@/modules/billing/listeners/invoice-payment-failed.listener';
import { SubscriptionDeletedListener } from '@/modules/billing/listeners/subscription-deleted.listener';
import { PaymentIntentSucceededListener } from '@/modules/billing/listeners/payment-intent-succeeded.listener';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    PaymentModule,
    EventOutboxModule,
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
