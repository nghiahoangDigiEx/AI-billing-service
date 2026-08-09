import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '@/common/exceptions';
import { CONFIG_KEYS } from '@/common/constants/config.constants';
import { BillingUoW } from '../billing.uow';
import { PaymentProviderFactory } from '@/modules/payment/factories/payment-provider.factory';
import { PaymentProvider } from '@/modules/payment/enums/payment-provider.enum';
import { SubscriptionInterval } from '@/modules/payment/enums/subscription-interval.enum';
import { SubscriptionOperationStatus } from '@/modules/billing/enums/subscription-operation-status.enum';
import { CreatePlanDto } from '@/modules/billing/dto/create-plan.dto';
import { UpdatePlanDto } from '@/modules/billing/dto/update-plan.dto';
import { CreatePlanPriceDto } from '@/modules/billing/dto/create-plan-price.dto';
import { CreateAddonPackageDto } from '@/modules/billing/dto/create-addon-package.dto';
import { UpdateAddonPackageDto } from '@/modules/billing/dto/update-addon-package.dto';
import { ErrorCode } from '@/common/enums/error-code.enum';
import {
  PlanStatus,
  SubscriptionStatus,
  CreditSource,
  CreditStatus,
} from '@prisma/client';
import { BillingOutboxWriter } from '@/modules/event-outbox/services/billing-outbox-writer.service';
import { BillingOutboxRelay } from '@/modules/event-outbox/providers/outbox-relay.service';
import {
  ADDON_FROZEN,
  ADDON_UNFROZEN,
  SUBSCRIPTION_DOWNGRADED,
} from '@/events/event.constants';
import { createDomainEvent } from '@/events/domain-event';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly uow: BillingUoW,
    private paymentProviderFactory: PaymentProviderFactory,
    private readonly outboxWriter: BillingOutboxWriter,
    private readonly relay: BillingOutboxRelay,
    private readonly configService: ConfigService,
  ) {}

  private getPaymentAdapter() {
    return this.paymentProviderFactory.getAdapter(PaymentProvider.STRIPE);
  }

  async createPlan(createPlanDto: CreatePlanDto) {
    const { name, slug, creditsIncluded, billingInterval, amount, currency } =
      createPlanDto;

    return this.uow.execute(async (repos) => {
      const existingPlan = await repos.plan.findBySlug(slug);

      if (existingPlan) {
        throw new AppException(
          ErrorCode.DUPLICATE_PLAN_SLUG,
          'Plan with this slug already exists',
          HttpStatus.CONFLICT,
        );
      }

      const stripeProduct = await this.getPaymentAdapter().createProduct(name);

      const stripePrice = await this.getPaymentAdapter().createPrice(
        stripeProduct.id,
        amount,
        currency,
        billingInterval.toLowerCase() as SubscriptionInterval,
      );

      const plan = await repos.plan.create({
        name,
        slug,
        creditsIncluded,
        stripeProductId: stripeProduct.id,
        prices: {
          create: {
            billingInterval,
            amount,
            currency,
            stripePriceId: stripePrice.id,
          },
        },
      });

      return plan;
    });
  }

  async getAllPlans() {
    return this.uow.readOnly.plan.findAllActive();
  }

  async getPlanById(id: string) {
    const plan = await this.uow.readOnly.plan.findByIdWithPrices(id);

    if (!plan) {
      throw new AppException(
        ErrorCode.PLAN_NOT_FOUND,
        'Plan not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return plan;
  }

  async updatePlan(id: string, updatePlanDto: UpdatePlanDto) {
    return this.uow.execute(async (repos) => {
      const plan = await repos.plan.findById(id);

      if (!plan) {
        throw new AppException(
          ErrorCode.PLAN_NOT_FOUND,
          'Plan not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (updatePlanDto.name) {
        await this.getPaymentAdapter().updateProduct(
          plan.stripeProductId,
          updatePlanDto.name,
        );
      }

      const updatedPlan = await repos.plan.update(id, updatePlanDto);
      return updatedPlan;
    });
  }

  async addPriceToPlan(planId: string, createPlanPriceDto: CreatePlanPriceDto) {
    return this.uow.execute(async (repos) => {
      const plan = await repos.plan.findById(planId);

      if (!plan) {
        throw new AppException(
          ErrorCode.PLAN_NOT_FOUND,
          'Plan not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const existingPrice = await repos.planPrice.findFirstActive(
        planId,
        createPlanPriceDto.billingInterval,
      );

      if (existingPrice) {
        throw new AppException(
          ErrorCode.DUPLICATE_BILLING_INTERVAL,
          'Active price for this billing interval already exists',
          HttpStatus.CONFLICT,
        );
      }

      const stripePrice = await this.getPaymentAdapter().createPrice(
        plan.stripeProductId,
        createPlanPriceDto.amount,
        createPlanPriceDto.currency,
        createPlanPriceDto.billingInterval.toLowerCase() as SubscriptionInterval,
      );

      const price = await repos.planPrice.create({
        planId,
        billingInterval: createPlanPriceDto.billingInterval,
        amount: createPlanPriceDto.amount,
        currency: createPlanPriceDto.currency,
        stripePriceId: stripePrice.id,
      });

      return price;
    });
  }

  async deactivatePlanPrice(planId: string, priceId: string) {
    return this.uow.execute(async (repos) => {
      const plan = await repos.plan.findById(planId);

      if (!plan) {
        throw new AppException(
          ErrorCode.PLAN_NOT_FOUND,
          'Plan not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const price = await repos.planPrice.findByIdAndPlanId(priceId, planId);

      if (!price) {
        throw new AppException(
          ErrorCode.PLAN_PRICE_NOT_FOUND,
          'Price not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const activePricesCount = await repos.planPrice.countActivePrices(planId);

      if (activePricesCount === 1 && price.status === PlanStatus.ACTIVE) {
        throw new AppException(
          ErrorCode.CANNOT_DEACTIVATE_LAST_PRICE,
          'Cannot deactivate the last active price for a plan',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedPrice = await repos.planPrice.updateStatus(
        priceId,
        PlanStatus.INACTIVE,
      );

      return updatedPrice;
    });
  }

  async createAddonPackage(createAddonPackageDto: CreateAddonPackageDto) {
    return this.uow.execute(async (repos) => {
      const { name, credits, amount, currency } = createAddonPackageDto;

      const stripeProduct = await this.getPaymentAdapter().createProduct(name);

      const stripePrice = await this.getPaymentAdapter().createPrice(
        stripeProduct.id,
        amount,
        currency,
      );

      const addonPackage = await repos.addonPackage.create({
        name,
        credits,
        amount,
        currency,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePrice.id,
      });

      return addonPackage;
    });
  }

  async getAllAddonPackages() {
    return this.uow.readOnly.addonPackage.findAllActive();
  }

  async getAddonPackageById(id: string) {
    const addonPackage = await this.uow.readOnly.addonPackage.findById(id);

    if (!addonPackage) {
      throw new AppException(
        ErrorCode.ADDON_NOT_FOUND,
        'Add-on package not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return addonPackage;
  }

  async updateAddonPackage(
    id: string,
    updateAddonPackageDto: UpdateAddonPackageDto,
  ) {
    return this.uow.execute(async (repos) => {
      const addonPackage = await repos.addonPackage.findById(id);

      if (!addonPackage) {
        throw new AppException(
          ErrorCode.ADDON_NOT_FOUND,
          'Add-on package not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (updateAddonPackageDto.name) {
        await this.getPaymentAdapter().updateProduct(
          addonPackage.stripeProductId,
          updateAddonPackageDto.name,
        );
      }

      const updatedAddonPackage = await repos.addonPackage.update(
        id,
        updateAddonPackageDto,
      );

      return updatedAddonPackage;
    });
  }

  async deactivateAddonPackage(id: string) {
    return this.uow.execute(async (repos) => {
      const addonPackage = await repos.addonPackage.findById(id);

      if (!addonPackage) {
        throw new AppException(
          ErrorCode.ADDON_NOT_FOUND,
          'Add-on package not found',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.getPaymentAdapter().archiveProduct(
        addonPackage.stripeProductId,
      );

      const updatedAddonPackage = await repos.addonPackage.update(id, {
        status: PlanStatus.INACTIVE,
      });

      return updatedAddonPackage;
    });
  }

  async upgradeSubscription(userId: string, planPriceId: string) {
    const user = await this.uow.readOnly.user.findById(userId);
    if (!user)
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );

    const price = await this.uow.readOnly.planPrice.findById(planPriceId);
    if (!price)
      throw new AppException(
        ErrorCode.PLAN_PRICE_NOT_FOUND,
        'Plan price not found',
        HttpStatus.NOT_FOUND,
      );

    if (!user.stripeCustomerId) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        'User does not have a Stripe customer ID',
        HttpStatus.BAD_REQUEST,
      );
    }

    const stripeSub = await this.getPaymentAdapter().createSubscription(
      user.stripeCustomerId,
      price.stripePriceId,
    );

    return {
      status: SubscriptionOperationStatus.ACCEPTED,
      stripeSubscriptionId: stripeSub.id,
    };
  }

  async getCurrentSubscription(userId: string) {
    const subscription =
      await this.uow.readOnly.subscription.findCurrentActive(userId);

    if (!subscription) {
      throw new AppException(
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
        'Active subscription not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return subscription;
  }

  async getSubscriptionHistory(userId: string) {
    return this.uow.readOnly.subscription.findHistory(userId);
  }

  async purchaseAddon(userId: string, addonId: string) {
    const user = await this.uow.readOnly.user.findById(userId);
    if (!user)
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );

    const addon = await this.uow.readOnly.addonPackage.findById(addonId);
    if (!addon)
      throw new AppException(
        ErrorCode.ADDON_NOT_FOUND,
        'Add-on package not found',
        HttpStatus.NOT_FOUND,
      );
    if (addon.status !== PlanStatus.ACTIVE)
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        'Add-on package is not active',
        HttpStatus.BAD_REQUEST,
      );

    if (!user.stripeCustomerId) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        'User does not have a Stripe customer ID',
        HttpStatus.BAD_REQUEST,
      );
    }

    const paymentIntent = await this.getPaymentAdapter().createPaymentIntent(
      addon.amount,
      addon.currency,
      user.stripeCustomerId,
      {
        addonId: addon.id,
        userId: user.id,
      },
    );

    return {
      status: SubscriptionOperationStatus.ACCEPTED,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
    };
  }

  async getUserAddonPurchases(userId: string) {
    return this.uow.readOnly.creditBalance.findUserAddonPurchases(userId);
  }

  async getUserAddonHistory(userId: string) {
    return this.uow.readOnly.creditBalance.findUserAddonHistory(userId);
  }

  async freezeAddons(
    userId: string,
    causationId?: string,
    correlationId?: string,
  ) {
    return this.uow.execute(async (repos) => {
      const result = await repos.creditBalance.freezeActiveAddons(userId);

      if (result.count > 0) {
        const domainEvent = createDomainEvent(
          ADDON_FROZEN,
          { userId, count: result.count },
          { causationId, correlationId },
        );
        await this.outboxWriter.insert(repos.tx, domainEvent);
      }

      return result;
    });
  }

  async unfreezeAddons(
    userId: string,
    causationId?: string,
    correlationId?: string,
  ) {
    return this.uow.execute(async (repos) => {
      const result = await repos.creditBalance.unfreezeFrozenAddons(userId);

      if (result.count > 0) {
        const domainEvent = createDomainEvent(
          ADDON_UNFROZEN,
          { userId, count: result.count },
          { causationId, correlationId },
        );
        await this.outboxWriter.insert(repos.tx, domainEvent);
      }

      return result;
    });
  }

  async downgradeToFree(
    userId: string,
    oldStripeSubscriptionId: string,
    causationId?: string,
    correlationId?: string,
  ) {
    const user = await this.uow.readOnly.user.findById(userId);
    if (!user || !user.stripeCustomerId) {
      this.logger.error(
        `User or stripe customer id not found for user ${userId}`,
      );
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User or stripe customer id not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const freePlanPriceId = this.configService.get<string>(
      CONFIG_KEYS.STRIPE_FREE_PLAN_PRICE_ID,
    );
    if (!freePlanPriceId) {
      throw new Error('Free plan price not configured');
    }

    let stripeSubId: string | null = null;
    try {
      const freeSub = await this.getPaymentAdapter().createSubscription(
        user.stripeCustomerId,
        freePlanPriceId,
      );
      stripeSubId = freeSub.id;
    } catch (error) {
      this.logger.error(
        `Failed to create Free Stripe subscription for downgrade:`,
        error,
      );
      throw error;
    }

    try {
      await this.uow.execute(async (repos) => {
        const activeSub = await repos.subscription.findCurrentActive(userId);
        if (activeSub) {
          await repos.tx.subscription.update({
            where: { id: activeSub.id },
            data: { status: SubscriptionStatus.CANCELLED },
          });
        }

        const planPrice =
          await repos.planPrice.findByStripePriceId(freePlanPriceId);

        if (!planPrice) {
          throw new Error('Free plan price not found in DB');
        }

        const freePlan = await repos.plan.findById(planPrice.planId);

        if (!freePlan) {
          throw new Error('Free plan not found in DB');
        }

        const periodStart = new Date();
        const periodEnd = new Date(
          new Date().setMonth(new Date().getMonth() + 1),
        );

        const newSub = await repos.subscription.create({
          userId,
          planId: freePlan.id,
          planPriceId: planPrice.id,
          stripeSubscriptionId: stripeSubId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });

        await repos.creditBalance.freezeActiveAddons(userId);

        await repos.tx.creditBalance.create({
          data: {
            userId,
            source: CreditSource.MONTHLY,
            sourceRef: newSub.id,
            totalCredits: freePlan.creditsIncluded,
            remainingCredits: freePlan.creditsIncluded,
            status: CreditStatus.ACTIVE,
            periodStart,
            periodEnd,
          },
        });

        const domainEvent = createDomainEvent(
          SUBSCRIPTION_DOWNGRADED,
          {
            userId,
            freePlanCredits: freePlan.creditsIncluded,
            newSubscriptionId: newSub.id,
          },
          { causationId, correlationId },
        );
        await this.outboxWriter.insert(repos.tx, domainEvent);
      });
    } catch (error) {
      this.logger.error(
        `DB transaction failed during downgrade, orphaned Stripe subscription: ${stripeSubId}`,
        error,
      );
      throw error;
    }
  }
}
