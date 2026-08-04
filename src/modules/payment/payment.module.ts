import { Module } from '@nestjs/common';
import { PaymentProviderFactory } from '@/modules/payment/factories/payment-provider.factory';
import { WebhookStrategyFactory } from '@/modules/payment/factories/webhook-strategy.factory';

@Module({
  providers: [PaymentProviderFactory, WebhookStrategyFactory],
  exports: [PaymentProviderFactory, WebhookStrategyFactory],
})
export class PaymentModule {}
