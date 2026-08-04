import { ApiStandardResponse } from '../../../common/decorators/api-standard-response.decorator';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BillingService } from '../services/billing.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CreatePlanPriceDto } from '../dto/create-plan-price.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Admin - Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/plans')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new plan (Admin only)' })
  @ApiStandardResponse({
    status: 201,
    description: 'Plan created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async createPlan(@Body() createPlanDto: CreatePlanDto) {
    return this.billingService.createPlan(createPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all plans (Admin only)' })
  @ApiStandardResponse({ status: 200, description: 'List of all plans' })
  async getAllPlans() {
    return this.billingService.getAllPlans();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID (Admin only)' })
  @ApiStandardResponse({ status: 200, description: 'Plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlanById(@Param('id') id: string) {
    return this.billingService.getPlanById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update plan (Admin only)' })
  @ApiStandardResponse({
    status: 200,
    description: 'Plan updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlan(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdatePlanDto,
  ) {
    return this.billingService.updatePlan(id, updatePlanDto);
  }

  @Post(':id/prices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add price to plan (Admin only)' })
  @ApiStandardResponse({ status: 201, description: 'Price added successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 409, description: 'Duplicate billing interval' })
  async addPriceToPlan(
    @Param('id') id: string,
    @Body() createPlanPriceDto: CreatePlanPriceDto,
  ) {
    return this.billingService.addPriceToPlan(id, createPlanPriceDto);
  }

  @Delete(':planId/prices/:priceId')
  @ApiOperation({ summary: 'Deactivate plan price (Admin only)' })
  @ApiStandardResponse({
    status: 200,
    description: 'Price deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Plan or price not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate last active price',
  })
  async deactivatePlanPrice(
    @Param('planId') planId: string,
    @Param('priceId') priceId: string,
  ) {
    return this.billingService.deactivatePlanPrice(planId, priceId);
  }
}
