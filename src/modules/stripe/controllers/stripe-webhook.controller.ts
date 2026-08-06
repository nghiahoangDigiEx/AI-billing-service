import { Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StripeWebhookService } from '@/modules/stripe/services/stripe-webhook.service';
import { WebhookStrategyFactory } from '@/modules/payment/factories/webhook-strategy.factory';
import { PaymentProvider } from '@/modules/payment/enums/payment-provider.enum';
import { Public } from '@/modules/auth/decorators/public.decorator';

@Public()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly webhookStrategyFactory: WebhookStrategyFactory,
  ) {}

  @Post()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send('Missing stripe-signature header');
    }

    try {
      const reqWithRawBody = req as unknown as { rawBody: string | Buffer };
      const rawBody = reqWithRawBody.rawBody;
      const strategy = this.webhookStrategyFactory.getStrategy(
        PaymentProvider.STRIPE,
      );
      const event = await strategy.parseEvent(rawBody, signature as string);

      try {
        await this.stripeWebhookService.handleEvent(event);
      } catch (err) {
        const error = err as { code?: string };
        if (error.code !== 'P2002') {
          this.logger.error('Webhook processing failed', err as Error);
        }
      }

      res.status(HttpStatus.OK).send({ received: true });
    } catch (error) {
      const err = error as Error;
      res.status(HttpStatus.BAD_REQUEST).send(`Webhook Error: ${err.message}`);
    }
  }
}
