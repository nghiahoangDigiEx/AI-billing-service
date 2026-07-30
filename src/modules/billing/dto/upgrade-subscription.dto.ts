import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpgradeSubscriptionDto {
  @ApiProperty({ description: 'Plan price ID to upgrade to' })
  @IsString()
  @IsNotEmpty()
  planPriceId!: string;
}
