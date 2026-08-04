import { IsString, IsOptional, MaxLength, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePlanDto {
  @ApiProperty({
    description: 'Plan name',
    example: 'Pro Plan',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Credits included per billing interval',
    example: 1000,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  creditsIncluded?: number;
}
