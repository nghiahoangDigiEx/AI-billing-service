import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { PlanResponseDto } from '@/modules/billing/dto/plan-response.dto';
import { PlanPriceResponseDto } from '@/modules/billing/dto/plan-price-response.dto';

export class SubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  planId!: string;

  @ApiProperty()
  planPriceId!: string;

  @ApiProperty()
  stripeSubscriptionId!: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiProperty()
  currentPeriodStart!: Date;

  @ApiProperty()
  currentPeriodEnd!: Date;

  @ApiProperty({ type: PlanResponseDto })
  plan!: PlanResponseDto;

  @ApiProperty({ type: PlanPriceResponseDto })
  planPrice!: PlanPriceResponseDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
