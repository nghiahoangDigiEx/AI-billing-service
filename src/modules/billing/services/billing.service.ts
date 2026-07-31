import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CreatePlanPriceDto } from '../dto/create-plan-price.dto';
import { CreateAddonPackageDto } from '../dto/create-addon-package.dto';
import { UpdateAddonPackageDto } from '../dto/update-addon-package.dto';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  PlanStatus,
  SubscriptionStatus,
  CreditSource,
  CreditStatus,
} from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async createPlan(createPlanDto: CreatePlanDto) {
    const { name, slug, creditsIncluded, billingInterval, amount, currency } =
      createPlanDto;

    const existingPlan = await this.prisma.plan.findUnique({
      where: { slug },
    });

    if (existingPlan) {
      throw new ConflictException(
        'Plan with this slug already exists',
        ErrorCode.DUPLICATE_PLAN_SLUG,
      );
    }

    const stripeProduct = await this.stripeService.createProduct(name);

    const stripePrice = await this.stripeService.createPrice(
      stripeProduct.id,
      amount,
      currency,
      billingInterval.toLowerCase() as 'month' | 'year',
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
      throw new NotFoundException('Plan not found', ErrorCode.PLAN_NOT_FOUND);
    }

    return plan;
  }

  async updatePlan(id: string, updatePlanDto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found', ErrorCode.PLAN_NOT_FOUND);
    }

    if (updatePlanDto.name) {
      await this.stripeService.updateProduct(
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
      throw new NotFoundException('Plan not found', ErrorCode.PLAN_NOT_FOUND);
    }

    const existingPrice = await this.prisma.planPrice.findFirst({
      where: {
        planId,
        billingInterval: createPlanPriceDto.billingInterval,
        status: PlanStatus.ACTIVE,
      },
    });

    if (existingPrice) {
      throw new ConflictException(
        'Active price for this billing interval already exists',
        ErrorCode.DUPLICATE_BILLING_INTERVAL,
      );
    }

    const stripePrice = await this.stripeService.createPrice(
      plan.stripeProductId,
      createPlanPriceDto.amount,
      createPlanPriceDto.currency,
      createPlanPriceDto.billingInterval.toLowerCase() as 'month' | 'year',
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
      throw new NotFoundException('Plan not found', ErrorCode.PLAN_NOT_FOUND);
    }

    const price = await this.prisma.planPrice.findFirst({
      where: {
        id: priceId,
        planId,
      },
    });

    if (!price) {
      throw new NotFoundException(
        'Price not found',
        ErrorCode.PLAN_PRICE_NOT_FOUND,
      );
    }

    const activePricesCount = await this.prisma.planPrice.count({
      where: {
        planId,
        status: PlanStatus.ACTIVE,
      },
    });

    if (activePricesCount === 1 && price.status === PlanStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot deactivate the last active price for a plan',
        ErrorCode.CANNOT_DEACTIVATE_LAST_PRICE,
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

    const stripeProduct = await this.stripeService.createProduct(name);

    const stripePrice = await this.stripeService.createPrice(
      stripeProduct.id,
      amount,
      currency,
      'month' as const,
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
      throw new NotFoundException(
        'Add-on package not found',
        ErrorCode.ADDON_NOT_FOUND,
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
      throw new NotFoundException(
        'Add-on package not found',
        ErrorCode.ADDON_NOT_FOUND,
      );
    }

    if (updateAddonPackageDto.name) {
      await this.stripeService.updateProduct(
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
      throw new NotFoundException(
        'Add-on package not found',
        ErrorCode.ADDON_NOT_FOUND,
      );
    }

    await this.stripeService.archiveProduct(addonPackage.stripeProductId);

    const updatedAddonPackage = await this.prisma.addonPackage.update({
      where: { id },
      data: { status: PlanStatus.INACTIVE },
    });

    return updatedAddonPackage;
  }
  async upgradeSubscription(userId: string, planPriceId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const price = await this.prisma.planPrice.findUnique({
      where: { id: planPriceId },
    });
    if (!price)
      throw new NotFoundException(
        'Plan price not found',
        ErrorCode.PLAN_PRICE_NOT_FOUND,
      );

    if (!user.stripeCustomerId) {
      throw new BadRequestException('User does not have a Stripe customer ID');
    }

    const stripeSub = await this.stripeService.createSubscription(
      user.stripeCustomerId,
      price.stripePriceId,
    );

    return { status: 'Accepted', stripeSubscriptionId: stripeSub.id };
  }

  async getCurrentSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true, planPrice: true },
    });

    if (!subscription) {
      throw new NotFoundException(
        'Active subscription not found',
        ErrorCode.SUBSCRIPTION_NOT_FOUND,
      );
    }

    return subscription;
  }

  async getSubscriptionHistory(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true, planPrice: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  async purchaseAddon(userId: string, addonId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const addon = await this.prisma.addonPackage.findUnique({
      where: { id: addonId },
    });
    if (!addon)
      throw new NotFoundException(
        'Add-on package not found',
        ErrorCode.ADDON_NOT_FOUND,
      );
    if (addon.status !== PlanStatus.ACTIVE)
      throw new BadRequestException('Add-on package is not active');

    if (!user.stripeCustomerId) {
      throw new BadRequestException('User does not have a Stripe customer ID');
    }

    const paymentIntent = await this.stripeService.createPaymentIntent(
      addon.amount,
      addon.currency,
      user.stripeCustomerId,
      {
        addonId: addon.id,
        userId: user.id,
      },
    );

    return {
      status: 'Accepted',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async getUserAddonPurchases(userId: string) {
    return this.prisma.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
        status: { in: [CreditStatus.ACTIVE, CreditStatus.FROZEN] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserAddonHistory(userId: string) {
    return this.prisma.creditBalance.findMany({
      where: {
        userId,
        source: CreditSource.ADDON,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
