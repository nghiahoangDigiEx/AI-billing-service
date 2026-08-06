import { ParsedWebhookEvent } from '@/modules/payment/interfaces/webhook-strategy.interface';

export interface StripeEventHandler {
  handle(event: ParsedWebhookEvent): void | Promise<void>;
}
