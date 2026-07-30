import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { Public } from '../user/decorators/public.decorator';

@ApiTags('Public - Plans')
@Public()
@Controller('plans')
export class PublicPlanController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List all active plans with active prices' })
  @ApiResponse({ status: 200, description: 'List of all active plans' })
  async getActivePlans() {
    return this.billingService.getAllPlans();
  }
}
