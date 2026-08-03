import { Injectable, Inject, Logger } from '@nestjs/common';
import { WebhookStrategy } from './webhook-strategy.interface';

@Injectable()
export class WebhookStrategyFactory {
  private readonly logger = new Logger(WebhookStrategyFactory.name);

  constructor(
    @Inject('WEBHOOK_STRATEGIES')
    private readonly strategies: WebhookStrategy[],
  ) {}

  getStrategy(eventType: string): WebhookStrategy | undefined {
    return this.strategies.find((strategy) => strategy.canHandle(eventType));
  }
}
