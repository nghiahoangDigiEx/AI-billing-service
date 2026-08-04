import { Injectable } from '@nestjs/common';
import { StripeEventHandler } from '../interfaces/stripe-event-handler.interface';

@Injectable()
export class StripeEventHandlerFactory {
  private handlers = new Map<string, StripeEventHandler>();

  registerHandler(eventType: string, handler: StripeEventHandler) {
    this.handlers.set(eventType, handler);
  }

  getHandler(eventType: string): StripeEventHandler | undefined {
    return this.handlers.get(eventType);
  }
}
