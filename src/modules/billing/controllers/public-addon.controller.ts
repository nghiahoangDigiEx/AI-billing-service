import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardResponse } from '@/common/decorators/api-standard-response.decorator';
import { BillingService } from '@/modules/billing/services/billing.service';
import { Public } from '@/modules/auth/decorators/public.decorator';

@ApiTags('Public - Add-ons')
@Public()
@Controller('addons')
export class PublicAddonController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List all active add-on packages' })
  @ApiStandardResponse({
    status: 200,
    description: 'List of all active add-on packages',
  })
  async getActiveAddonPackages() {
    return this.billingService.getAllAddonPackages();
  }
}
