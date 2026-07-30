import { ApiProperty } from '@nestjs/swagger';

export class AddonPurchaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  addonPackageId!: string;

  @ApiProperty()
  stripePaymentIntentId!: string;

  @ApiProperty()
  createdAt!: Date;
}
