import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { STRIPE_SETUP_SUCCESS } from '@/events/event.constants';
import type { DomainEvent } from '@/events/domain-event';
import { UserUoW } from '../user.uow';

@Injectable()
export class BillingListener {
  private readonly logger = new Logger(BillingListener.name);

  constructor(private readonly uow: UserUoW) {}

  @OnEvent(STRIPE_SETUP_SUCCESS)
  async handle(
    event: DomainEvent<{ userId: string; stripeCustomerId: string }>,
  ): Promise<void> {
    const { userId, stripeCustomerId } = event.payload;

    try {
      await this.uow.execute(async (repos) => {
        const user = await repos.user.findById(userId);
        if (!user) {
          this.logger.warn(
            `User ${userId} not found when handling STRIPE_SETUP_SUCCESS`,
          );
          return;
        }

        if (
          user.pendingStripeSetup ||
          user.stripeCustomerId !== stripeCustomerId
        ) {
          await repos.user.update(userId, {
            pendingStripeSetup: false,
            stripeCustomerId,
          });
          this.logger.log(
            `Updated user ${userId} with Stripe customer ${stripeCustomerId}`,
          );
        } else {
          this.logger.debug(
            `User ${userId} already has Stripe setup completed`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle STRIPE_SETUP_SUCCESS for user ${userId}`,
        error,
      );
    }
  }
}
