import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardResponse } from '../../../common/decorators/api-standard-response.decorator';
import { BillingService } from '../services/billing.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('Public - Plans')
@Public()
@Controller('plans')
export class PublicPlanController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List all active plans with active prices' })
  @ApiStandardResponse({ status: 200, description: 'List of all active plans' })
  async getActivePlans() {
    return this.billingService.getAllPlans();
  }
}
