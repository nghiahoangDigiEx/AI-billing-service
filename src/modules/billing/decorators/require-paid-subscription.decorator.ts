import { UseGuards, applyDecorators } from '@nestjs/common';
import { RequirePaidSubscriptionGuard } from '@/modules/billing/guards/require-paid-subscription.guard';

export function RequirePaidSubscription() {
  return applyDecorators(UseGuards(RequirePaidSubscriptionGuard));
}
