import { ApiProperty } from '@nestjs/swagger';
import { BillingInterval, PlanStatus } from '@prisma/client';

export class PlanPriceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  stripePriceId!: string;

  @ApiProperty()
  planId!: string;

  @ApiProperty({ enum: BillingInterval })
  billingInterval!: BillingInterval;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: PlanStatus })
  status!: PlanStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
