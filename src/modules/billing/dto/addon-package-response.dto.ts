import { ApiProperty } from '@nestjs/swagger';
import { PlanStatus } from '@prisma/client';

export class AddonPackageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  stripeProductId!: string;

  @ApiProperty()
  stripePriceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  credits!: number;

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
