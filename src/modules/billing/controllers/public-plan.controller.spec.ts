import { Test, TestingModule } from '@nestjs/testing';
import { PublicPlanController } from './public-plan.controller';
import { BillingService } from '../services/billing.service';

describe('PublicPlanController', () => {
  let controller: PublicPlanController;
  let billingService: Partial<BillingService>;

  beforeEach(async () => {
    billingService = {
      getAllPlans: jest
        .fn()
        .mockResolvedValue([{ id: 'plan_1', name: 'Pro Plan' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicPlanController],
      providers: [
        {
          provide: BillingService,
          useValue: billingService,
        },
      ],
    }).compile();

    controller = module.get<PublicPlanController>(PublicPlanController);
  });

  it('should return active plans', async () => {
    const result = await controller.getActivePlans();
    expect(result).toEqual([{ id: 'plan_1', name: 'Pro Plan' }]);
    expect(billingService.getAllPlans).toHaveBeenCalled();
  });
});
