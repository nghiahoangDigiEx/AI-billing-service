import { Injectable } from '@nestjs/common';
import { WebhookStrategy } from '../interfaces/webhook-strategy.interface';
import { PaymentProvider } from '../enums/payment-provider.enum';

@Injectable()
export class WebhookStrategyFactory {
  private strategies = new Map<PaymentProvider, WebhookStrategy>();

  registerStrategy(provider: PaymentProvider, strategy: WebhookStrategy) {
    this.strategies.set(provider, strategy);
  }

  getStrategy(provider: PaymentProvider): WebhookStrategy {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new Error(`Webhook strategy for ${provider} not found`);
    }
    return strategy;
  }
}
