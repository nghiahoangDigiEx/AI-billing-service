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
  providers: [StripeService, BillingService, WebhookService, BillingScheduler],
  exports: [StripeService, BillingService],
})
export class BillingModule {}
