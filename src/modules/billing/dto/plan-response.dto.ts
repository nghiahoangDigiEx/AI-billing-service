import { ApiProperty } from '@nestjs/swagger';
import { PlanStatus } from '@prisma/client';
import { PlanPriceResponseDto } from '@/modules/billing/dto/plan-price-response.dto';

export class PlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  stripeProductId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  creditsIncluded!: number;

  @ApiProperty({ enum: PlanStatus })
  status!: PlanStatus;

  @ApiProperty({ type: [PlanPriceResponseDto] })
  prices!: PlanPriceResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
