import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BillingInterval } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty({ description: 'Plan name', example: 'Pro Plan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'pro' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @ApiProperty({
    description: 'Credits included per billing interval',
    example: 1000,
  })
  @IsInt()
  @Min(0)
  creditsIncluded!: number;

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
