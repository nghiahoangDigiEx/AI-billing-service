import { IsEnum, IsInt, IsString, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BillingInterval } from '@prisma/client';

export class CreatePlanPriceDto {
  @ApiProperty({ description: 'Billing interval', enum: BillingInterval })
  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @ApiProperty({ description: 'Price amount in cents', example: 1000 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiProperty({ description: 'Currency code', example: 'usd' })
  @IsString()
  @IsNotEmpty()
  currency!: string;
}
