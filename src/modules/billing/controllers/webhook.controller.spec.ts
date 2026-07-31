import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { StripeService } from '../services/stripe.service';
import { WebhookService } from '../services/webhook.service';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('WebhookController', () => {
  let controller: WebhookController;
  let stripeService: jest.Mocked<StripeService>;
  let webhookService: jest.Mocked<WebhookService>;

  beforeEach(async () => {
    const mockStripeService = {
      verifyWebhookSignature: jest.fn(),
    };

    const mockWebhookService = {
      processEvent: jest.fn(),
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
      await expect(controller.handleStripeWebhook('', req)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if rawBody is missing', async () => {
      const req = {};
      await expect(controller.handleStripeWebhook('sig', req)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if signature verification fails', async () => {
      const req = { rawBody: Buffer.from('payload') };
      stripeService.verifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(controller.handleStripeWebhook('sig', req)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException if processing fails', async () => {
      const req = { rawBody: Buffer.from('payload') };
      const mockEvent = { id: 'evt_1', type: 'invoice.paid' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      stripeService.verifyWebhookSignature.mockReturnValue(mockEvent as any);
      webhookService.processEvent.mockRejectedValue(new Error('DB Error'));

      await expect(controller.handleStripeWebhook('sig', req)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should return { received: true } on success', async () => {
      const req = { rawBody: Buffer.from('payload') };
      const mockEvent = { id: 'evt_1', type: 'invoice.paid' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      stripeService.verifyWebhookSignature.mockReturnValue(mockEvent as any);
      webhookService.processEvent.mockResolvedValue(undefined);

      const result = await controller.handleStripeWebhook('sig', req);
      expect(result).toEqual({ received: true });
      expect(webhookService.processEvent).toHaveBeenCalledWith(mockEvent);
    });
  });
});
