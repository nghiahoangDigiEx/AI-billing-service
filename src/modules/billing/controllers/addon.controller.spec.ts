import { Test, TestingModule } from '@nestjs/testing';
import { AddonController } from './addon.controller';
import { BillingService } from '../services/billing.service';

describe('AddonController', () => {
  let controller: AddonController;
  let billingService: Partial<BillingService>;

  beforeEach(async () => {
    billingService = {
      createAddonPackage: jest.fn().mockResolvedValue({ id: 'addon-1' }),
      getAllAddonPackages: jest.fn().mockResolvedValue([{ id: 'addon-1' }]),
      getAddonPackageById: jest.fn().mockResolvedValue({ id: 'addon-1' }),
      updateAddonPackage: jest
        .fn()
        .mockResolvedValue({ id: 'addon-1', name: 'Updated' }),
      deactivateAddonPackage: jest
        .fn()
        .mockResolvedValue({ id: 'addon-1', status: 'INACTIVE' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddonController],
      providers: [
        {
          provide: BillingService,
          useValue: billingService,
        },
      ],
    }).compile();

    controller = module.get<AddonController>(AddonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAddonPackage', () => {
    it('should call billingService.createAddonPackage', async () => {
      const dto = {
        name: 'Addon',
        credits: 100,
        amount: 1000,
        currency: 'usd',
      };
      const result = await controller.createAddonPackage(dto);
      expect(result).toEqual({ id: 'addon-1' });
      expect(billingService.createAddonPackage).toHaveBeenCalledWith(dto);
    });
  });

  describe('getAllAddonPackages', () => {
    it('should call billingService.getAllAddonPackages', async () => {
      const result = await controller.getAllAddonPackages();
      expect(result).toEqual([{ id: 'addon-1' }]);
      expect(billingService.getAllAddonPackages).toHaveBeenCalled();
    });
  });

  describe('getAddonPackageById', () => {
    it('should call billingService.getAddonPackageById', async () => {
      const result = await controller.getAddonPackageById('addon-1');
      expect(result).toEqual({ id: 'addon-1' });
      expect(billingService.getAddonPackageById).toHaveBeenCalledWith(
        'addon-1',
      );
    });
  });

  describe('updateAddonPackage', () => {
    it('should call billingService.updateAddonPackage', async () => {
      const dto = { name: 'Updated' };
      const result = await controller.updateAddonPackage('addon-1', dto);
      expect(result).toEqual({ id: 'addon-1', name: 'Updated' });
      expect(billingService.updateAddonPackage).toHaveBeenCalledWith(
        'addon-1',
        dto,
      );
    });
  });

  describe('deactivateAddonPackage', () => {
    it('should call billingService.deactivateAddonPackage', async () => {
      const result = await controller.deactivateAddonPackage('addon-1');
      expect(result).toEqual({ id: 'addon-1', status: 'INACTIVE' });
      expect(billingService.deactivateAddonPackage).toHaveBeenCalledWith(
        'addon-1',
      );
    });
  });
});
