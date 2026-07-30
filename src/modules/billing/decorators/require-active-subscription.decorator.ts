import { UseGuards, applyDecorators } from '@nestjs/common';
import { RequireActiveSubscriptionGuard } from '../guards/require-active-subscription.guard';

export function RequireActiveSubscription() {
  return applyDecorators(UseGuards(RequireActiveSubscriptionGuard));
}
