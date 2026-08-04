import { Module } from '@nestjs/common';
import { PaymentProviderFactory } from './factories/payment-provider.factory';
import { WebhookStrategyFactory } from './factories/webhook-strategy.factory';

@Module({
  providers: [PaymentProviderFactory, WebhookStrategyFactory],
  exports: [PaymentProviderFactory, WebhookStrategyFactory],
})
export class PaymentModule {}
