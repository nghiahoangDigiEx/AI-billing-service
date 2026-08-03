import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { WebhookController } from './webhook.controller';
import { StripeService } from '../services/stripe.service';
import { WebhookService } from '../services/webhook.service';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

describe('WebhookController', () => {
  let controller: WebhookController;
  let stripeService: jest.Mocked<StripeService>;
  let webhookService: jest.Mocked<WebhookService>;

  beforeEach(async () => {
    const mockStripeService = {
      verifyWebhookSignature: jest.fn(),
    };

    const mockWebhookService = {
      handleEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: StripeService, useValue: mockStripeService },
        { provide: WebhookService, useValue: mockWebhookService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test_webhook_secret'),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    stripeService = module.get(StripeService);
    webhookService = module.get(WebhookService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    it('should throw BadRequestException if signature is missing', async () => {
      const req = { rawBody: Buffer.from('payload') };
      await expect(
        controller.handleStripeWebhook(
          '',
          req as unknown as Request & { rawBody: Buffer },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rawBody is missing', async () => {
      const req = {};
      await expect(
        controller.handleStripeWebhook(
          'sig',
          req as unknown as Request & { rawBody: Buffer },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if signature verification fails', async () => {
      const req = { rawBody: Buffer.from('payload') };
      stripeService.verifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        controller.handleStripeWebhook(
          'sig',
          req as unknown as Request & { rawBody: Buffer },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException if processing fails', async () => {
      const req = { rawBody: Buffer.from('payload') };
      const mockEvent = { id: 'evt_1', type: 'invoice.paid' };

      stripeService.verifyWebhookSignature.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      webhookService.handleEvent.mockRejectedValue(new Error('DB Error'));

      await expect(
        controller.handleStripeWebhook(
          'sig',
          req as unknown as Request & { rawBody: Buffer },
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should return { received: true } on success', async () => {
      const req = { rawBody: Buffer.from('payload') };
      const mockEvent = { id: 'evt_1', type: 'invoice.paid' };

      stripeService.verifyWebhookSignature.mockReturnValue(
        mockEvent as unknown as Stripe.Event,
      );
      webhookService.handleEvent.mockResolvedValue(undefined);

      const result = await controller.handleStripeWebhook(
        'sig',
        req as unknown as Request & { rawBody: Buffer },
      );
      expect(result).toEqual({ received: true });
      expect(webhookService.handleEvent).toHaveBeenCalledWith(mockEvent);
    });
  });
});
