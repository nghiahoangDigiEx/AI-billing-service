import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { StripeService } from './stripe.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AddonController } from './addon.controller';
import { PublicPlanController } from './public-plan.controller';
import { PublicAddonController } from './public-addon.controller';
import { SubscriptionController } from './subscription.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { BillingScheduler } from './billing.scheduler';

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
