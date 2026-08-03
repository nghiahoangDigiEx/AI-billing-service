import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { StripeService } from './services/stripe.service';
import { BillingService } from './services/billing.service';
import { BillingController } from './controllers/billing.controller';
import { AddonController } from './controllers/addon.controller';
import { PublicPlanController } from './controllers/public-plan.controller';
import { PublicAddonController } from './controllers/public-addon.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookService } from './services/webhook.service';
import { BillingScheduler } from './services/billing.scheduler';

import { InvoicePaidStrategy } from './strategies/invoice-paid.strategy';
import { InvoicePaymentFailedStrategy } from './strategies/invoice-payment-failed.strategy';
import { SubscriptionDeletedStrategy } from './strategies/subscription-deleted.strategy';
import { PaymentIntentSucceededStrategy } from './strategies/payment-intent-succeeded.strategy';
import { WebhookStrategyFactory } from './strategies/webhook-strategy.factory';
import { WebhookStrategy } from './strategies/webhook-strategy.interface';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), PrismaModule],
  controllers: [
    BillingController,
    AddonController,
    PublicPlanController,
    PublicAddonController,
    SubscriptionController,
    WebhookController,
  ],
  providers: [
    StripeService,
    BillingService,
    WebhookService,
    BillingScheduler,
    WebhookStrategyFactory,
    InvoicePaidStrategy,
    InvoicePaymentFailedStrategy,
    SubscriptionDeletedStrategy,
    PaymentIntentSucceededStrategy,
    {
      provide: 'WEBHOOK_STRATEGIES',
      useFactory: (...strategies: WebhookStrategy[]) => strategies,
      inject: [
        InvoicePaidStrategy,
        InvoicePaymentFailedStrategy,
        SubscriptionDeletedStrategy,
        PaymentIntentSucceededStrategy,
      ],
    },
  ],
  exports: [StripeService, BillingService],
})
export class BillingModule {}
