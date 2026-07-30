import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { Public } from '../user/decorators/public.decorator';

@ApiTags('Public - Add-ons')
@Public()
@Controller('addons')
export class PublicAddonController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List all active add-on packages' })
  @ApiResponse({
    status: 200,
    description: 'List of all active add-on packages',
  })
  async getActiveAddonPackages() {
    return this.billingService.getAllAddonPackages();
  }
}
