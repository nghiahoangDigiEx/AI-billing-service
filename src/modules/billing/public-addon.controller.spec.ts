import { Test, TestingModule } from '@nestjs/testing';
import { PublicAddonController } from './public-addon.controller';
import { BillingService } from './billing.service';

describe('PublicAddonController', () => {
  let controller: PublicAddonController;
  let billingService: Partial<BillingService>;

  beforeEach(async () => {
    billingService = {
      getAllAddonPackages: jest
        .fn()
        .mockResolvedValue([{ id: 'addon_1', name: '100 Credits' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicAddonController],
      providers: [
        {
          provide: BillingService,
          useValue: billingService,
        },
      ],
    }).compile();

    controller = module.get<PublicAddonController>(PublicAddonController);
  });

  it('should return active addons', async () => {
    const result = await controller.getActiveAddonPackages();
    expect(result).toEqual([{ id: 'addon_1', name: '100 Credits' }]);
    expect(billingService.getAllAddonPackages).toHaveBeenCalled();
  });
});
