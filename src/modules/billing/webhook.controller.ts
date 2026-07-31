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
import { StripeService } from './stripe.service';
import { WebhookService } from './webhook.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';

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
    @Req() req: any,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event: Stripe.Event;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      event = this.stripeService.verifyWebhookSignature(req.rawBody, signature);
    } catch (err) {
      const error = err as Error;
      throw new BadRequestException(`Webhook Error: ${error.message}`);
    }

    try {
      await this.webhookService.processEvent(event);
      return { received: true };
    } catch (err) {
      const error = err as Error;
      // Return 500 so Stripe retries the webhook
      throw new InternalServerErrorException(error.message);
    }
  }
}
