import { Injectable, HttpStatus } from '@nestjs/common';
import { AppException } from '@/common/exceptions';
import { PrismaService } from '@/prisma/prisma.service';
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
import { SortOrder } from '@/common/enums/sort-order.enum';
@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private paymentProviderFactory: PaymentProviderFactory,
  ) {}

  private getPaymentAdapter() {
    return this.paymentProviderFactory.getAdapter(PaymentProvider.STRIPE);
  }

  async createPlan(createPlanDto: CreatePlanDto) {
    const { name, slug, creditsIncluded, billingInterval, amount, currency } =
      createPlanDto;

    const existingPlan = await this.prisma.plan.findUnique({
      where: { slug },
    });

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

    const plan = await this.prisma.plan.create({
      data: {
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
      },
      include: {
        prices: true,
      },
    });

    return plan;
  }

  async getAllPlans() {
    return this.prisma.plan.findMany({
      where: { status: PlanStatus.ACTIVE },
      include: {
        prices: {
          where: { status: PlanStatus.ACTIVE },
        },
      },
    });
  }

  async getPlanById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        prices: true,
      },
    });

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
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

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

    const updatedPlan = await this.prisma.plan.update({
      where: { id },
      data: updatePlanDto,
      include: {
        prices: true,
      },
    });

    return updatedPlan;
  }

  async addPriceToPlan(planId: string, createPlanPriceDto: CreatePlanPriceDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppException(
        ErrorCode.PLAN_NOT_FOUND,
        'Plan not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const existingPrice = await this.prisma.planPrice.findFirst({
      where: {
        planId,
        billingInterval: createPlanPriceDto.billingInterval,
        status: PlanStatus.ACTIVE,
      },
    });

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

    const price = await this.prisma.planPrice.create({
      data: {
        planId,
        billingInterval: createPlanPriceDto.billingInterval,
        amount: createPlanPriceDto.amount,
        currency: createPlanPriceDto.currency,
        stripePriceId: stripePrice.id,
      },
    });

    return price;
  }

  async deactivatePlanPrice(planId: string, priceId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppException(
        ErrorCode.PLAN_NOT_FOUND,
        'Plan not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const price = await this.prisma.planPrice.findFirst({
      where: {
        id: priceId,
        planId,
      },
    });

    if (!price) {
      throw new AppException(
        ErrorCode.PLAN_PRICE_NOT_FOUND,
        'Price not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const activePricesCount = await this.prisma.planPrice.count({
      where: {
        planId,
        status: PlanStatus.ACTIVE,
      },
    });

    if (activePricesCount === 1 && price.status === PlanStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.CANNOT_DEACTIVATE_LAST_PRICE,
        'Cannot deactivate the last active price for a plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedPrice = await this.prisma.planPrice.update({
      where: { id: priceId },
      data: { status: PlanStatus.INACTIVE },
    });

    return updatedPrice;
  }

  async createAddonPackage(createAddonPackageDto: CreateAddonPackageDto) {
    const { name, credits, amount, currency } = createAddonPackageDto;

    const stripeProduct = await this.getPaymentAdapter().createProduct(name);

    const stripePrice = await this.getPaymentAdapter().createPrice(
      stripeProduct.id,
      amount,
      currency,
    );

    const addonPackage = await this.prisma.addonPackage.create({
      data: {
        name,
        credits,
        amount,
        currency,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePrice.id,
      },
    });

    return addonPackage;
  }

  async getAllAddonPackages() {
    return this.prisma.addonPackage.findMany({
      where: { status: PlanStatus.ACTIVE },
    });
  }

  async getAddonPackageById(id: string) {
    const addonPackage = await this.prisma.addonPackage.findUnique({
      where: { id },
    });

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
    const addonPackage = await this.prisma.addonPackage.findUnique({
      where: { id },
    });

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

    const updatedAddonPackage = await this.prisma.addonPackage.update({
      where: { id },
      data: updateAddonPackageDto,
    });

    return updatedAddonPackage;
  }

  async deactivateAddonPackage(id: string) {
    const addonPackage = await this.prisma.addonPackage.findUnique({
      where: { id },
    });

    if (!addonPackage) {
      throw new AppException(
        ErrorCode.ADDON_NOT_FOUND,
        'Add-on package not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.getPaymentAdapter().archiveProduct(addonPackage.stripeProductId);

    const updatedAddonPackage = await this.prisma.addonPackage.update({
      where: { id },
      data: { status: PlanStatus.INACTIVE },
    });

    return updatedAddonPackage;
  }
  async upgradeSubscription(userId: string, planPriceId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );

    const price = await this.prisma.planPrice.findUnique({
      where: { id: planPriceId },
    });
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
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true, planPrice: true },
    });

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
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true, planPrice: true },
      orderBy: { createdAt: SortOrder.DESC },
    });
  }
  async purchaseAddon(userId: string, addonId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );

    const addon = await this.prisma.addonPackage.findUnique({
      where: { id: addonId },
    });
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
    return this.prisma.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: { in: [CreditStatus.ACTIVE, CreditStatus.FROZEN] },
      },
      orderBy: { createdAt: SortOrder.DESC },
    });
  }

  async getUserAddonHistory(userId: string) {
    return this.prisma.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
      },
      orderBy: { createdAt: SortOrder.DESC },
    });
  }
}
