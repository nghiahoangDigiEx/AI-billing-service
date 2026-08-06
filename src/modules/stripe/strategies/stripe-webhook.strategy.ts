import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  WebhookStrategy,
  ParsedWebhookEvent,
} from '@/modules/payment/interfaces/webhook-strategy.interface';
import { CONFIG_KEYS } from '@/common/constants/config.constants';

@Injectable()
export class StripeWebhookStrategy implements WebhookStrategy {
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>(CONFIG_KEYS.STRIPE_SECRET_KEY) || '',
      { apiVersion: '2026-06-24.dahlia' },
    );
  }

  parseEvent(payload: Buffer | string, signature: string): ParsedWebhookEvent {
    const webhookSecret = this.configService.get<string>(
      CONFIG_KEYS.STRIPE_WEBHOOK_SECRET,
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    return {
      id: event.id,
      type: event.type,
      data: event.data.object,
      raw: event,
    };
  }

  extractEventType(event: ParsedWebhookEvent): string {
    return event.type;
  }
}
