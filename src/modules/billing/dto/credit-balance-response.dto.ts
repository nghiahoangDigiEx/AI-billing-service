import { ApiProperty } from '@nestjs/swagger';
import { CreditSource, CreditStatus } from '@prisma/client';

export class CreditBalanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: CreditSource })
  source!: CreditSource;

  @ApiProperty()
  sourceRef!: string;

  @ApiProperty()
  totalCredits!: number;

  @ApiProperty()
  remainingCredits!: number;

  @ApiProperty({ enum: CreditStatus })
  status!: CreditStatus;

  @ApiProperty({ required: false })
  periodStart?: Date;

  @ApiProperty({ required: false })
  periodEnd?: Date;

  @ApiProperty({ required: false })
  purchasedAt?: Date;

  @ApiProperty({ required: false })
  frozenAt?: Date;

  @ApiProperty({ required: false })
  unfrozenAt?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
