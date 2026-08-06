import { ApiStandardResponse } from '@/common/decorators/api-standard-response.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from '@/modules/billing/services/billing.service';
import { UpgradeSubscriptionDto } from '@/modules/billing/dto/upgrade-subscription.dto';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequirePaidSubscriptionGuard } from '@/modules/billing/guards/require-paid-subscription.guard';
import { Param } from '@nestjs/common';

@ApiTags('User - Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly billingService: BillingService) {}

  @Post('upgrade')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upgrade from Free to paid plan' })
  @ApiStandardResponse({
    status: 202,
    description: 'Upgrade process initiated successfully',
  })
  async upgradeSubscription(
    @CurrentUser() user: { id: string },
    @Body() upgradeSubscriptionDto: UpgradeSubscriptionDto,
  ) {
    return this.billingService.upgradeSubscription(
      user.id,
      upgradeSubscriptionDto.planPriceId,
    );
  }

  @Get('current')
  @ApiOperation({ summary: 'View current active subscription' })
  @ApiStandardResponse({
    status: 200,
    description: 'Current active subscription',
  })
  async getCurrentSubscription(@CurrentUser() user: { id: string }) {
    return this.billingService.getCurrentSubscription(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'View subscription history' })
  @ApiStandardResponse({
    status: 200,
    description: 'List of all subscriptions',
  })
  async getSubscriptionHistory(@CurrentUser() user: { id: string }) {
    return this.billingService.getSubscriptionHistory(user.id);
  }

  @Post('addons/:id/purchase')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RequirePaidSubscriptionGuard)
  @ApiOperation({ summary: 'Purchase one-time credit pack (Add-on)' })
  @ApiStandardResponse({
    status: 202,
    description: 'Purchase initiated successfully',
  })
  async purchaseAddon(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.billingService.purchaseAddon(user.id, id);
  }

  @Get('addons/purchases')
  @ApiOperation({ summary: 'View active and frozen add-ons' })
  @ApiStandardResponse({
    status: 200,
    description: 'List of active and frozen add-on purchases',
  })
  async getUserAddonPurchases(@CurrentUser() user: { id: string }) {
    return this.billingService.getUserAddonPurchases(user.id);
  }

  @Get('addons/purchases/history')
  @ApiOperation({ summary: 'View all add-on purchases' })
  @ApiStandardResponse({
    status: 200,
    description: 'List of all add-on purchases',
  })
  async getUserAddonHistory(@CurrentUser() user: { id: string }) {
    return this.billingService.getUserAddonHistory(user.id);
  }
}
