import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateAddonPackageDto } from './dto/create-addon-package.dto';
import { UpdateAddonPackageDto } from './dto/update-addon-package.dto';
import { AdminOnly } from './decorators/admin-only.decorator';

@ApiTags('Admin - Add-ons')
@ApiBearerAuth()
@Controller('admin/addons')
export class AddonController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new add-on package (Admin only)' })
  @ApiStandardResponse({
    status: 201,
    description: 'Add-on package created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async createAddonPackage(
    @Body() createAddonPackageDto: CreateAddonPackageDto,
  ) {
    return this.billingService.createAddonPackage(createAddonPackageDto);
  }

  @Get()
  @AdminOnly()
  @ApiOperation({ summary: 'Get all add-on packages (Admin only)' })
  @ApiStandardResponse({
    status: 200,
    description: 'List of all add-on packages',
  })
  async getAllAddonPackages() {
    return this.billingService.getAllAddonPackages();
  }

  @Get(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Get add-on package by ID (Admin only)' })
  @ApiStandardResponse({ status: 200, description: 'Add-on package details' })
  @ApiResponse({ status: 404, description: 'Add-on package not found' })
  async getAddonPackageById(@Param('id') id: string) {
    return this.billingService.getAddonPackageById(id);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update add-on package (Admin only)' })
  @ApiStandardResponse({
    status: 200,
    description: 'Add-on package updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Add-on package not found' })
  async updateAddonPackage(
    @Param('id') id: string,
    @Body() updateAddonPackageDto: UpdateAddonPackageDto,
  ) {
    return this.billingService.updateAddonPackage(id, updateAddonPackageDto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Deactivate add-on package (Admin only)' })
  @ApiStandardResponse({
    status: 200,
    description: 'Add-on package deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Add-on package not found' })
  async deactivateAddonPackage(@Param('id') id: string) {
    return this.billingService.deactivateAddonPackage(id);
  }
}
