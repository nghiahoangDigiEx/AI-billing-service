import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  RawBodyRequest,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from './stripe.service';
import { WebhookService } from './webhook.service';
import { Public } from '../user/decorators/public.decorator';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: WebhookService,
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

    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event;
    try {
      event = this.stripeService.verifyWebhookSignature(req.rawBody, signature);
    } catch (err: any) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    try {
      await this.webhookService.processEvent(event);
      return { received: true };
    } catch (err: any) {
      // Return 500 so Stripe retries the webhook
      throw new InternalServerErrorException(err.message);
    }
  }
}
