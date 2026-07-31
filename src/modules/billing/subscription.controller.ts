import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { CurrentUser } from '../user/decorators/current-user.decorator';
import { RequirePaidSubscriptionGuard } from './guards/require-paid-subscription.guard';
import { Param } from '@nestjs/common';

@ApiTags('User - Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly billingService: BillingService) {}

  @Post('upgrade')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upgrade from Free to paid plan' })
  @ApiResponse({
    status: 202,
    description: 'Upgrade process initiated successfully',
  })
  async upgradeSubscription(
    @CurrentUser() user: any,
    @Body() upgradeSubscriptionDto: UpgradeSubscriptionDto,
  ) {
    return this.billingService.upgradeSubscription(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      user.id,
      upgradeSubscriptionDto.planPriceId,
    );
  }

  @Get('current')
  @ApiOperation({ summary: 'View current active subscription' })
  @ApiResponse({ status: 200, description: 'Current active subscription' })
  async getCurrentSubscription(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.billingService.getCurrentSubscription(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'View subscription history' })
  @ApiResponse({ status: 200, description: 'List of all subscriptions' })
  async getSubscriptionHistory(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.billingService.getSubscriptionHistory(user.id);
  }

  @Post('addons/:id/purchase')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RequirePaidSubscriptionGuard)
  @ApiOperation({ summary: 'Purchase one-time credit pack (Add-on)' })
  @ApiResponse({ status: 202, description: 'Purchase initiated successfully' })
  async purchaseAddon(@CurrentUser() user: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.billingService.purchaseAddon(user.id, id);
  }

  @Get('addons/purchases')
  @ApiOperation({ summary: 'View active and frozen add-ons' })
  @ApiResponse({
    status: 200,
    description: 'List of active and frozen add-on purchases',
  })
  async getUserAddonPurchases(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.billingService.getUserAddonPurchases(user.id);
  }

  @Get('addons/purchases/history')
  @ApiOperation({ summary: 'View all add-on purchases' })
  @ApiResponse({ status: 200, description: 'List of all add-on purchases' })
  async getUserAddonHistory(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.billingService.getUserAddonHistory(user.id);
  }
}
