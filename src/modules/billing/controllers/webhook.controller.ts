import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from '../services/stripe.service';
import { WebhookService } from '../services/webhook.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request & { rawBody: Buffer },
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.verifyWebhookSignature(req.rawBody, signature);
    } catch (err) {
      const error = err as Error;
      throw new BadRequestException(`Webhook Error: ${error.message}`);
    }

    try {
      await this.webhookService.handleEvent(event);
      return { received: true };
    } catch (err) {
      const error = err as Error;
      // Return 500 so Stripe retries the webhook
      throw new InternalServerErrorException(error.message);
    }
  }
}
