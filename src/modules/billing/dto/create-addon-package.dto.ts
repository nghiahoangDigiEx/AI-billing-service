import { IsString, IsNotEmpty, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddonPackageDto {
  @ApiProperty({
    description: 'Add-on package name',
    example: '100 Credits Pack',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Number of credits included', example: 100 })
  @IsInt()
  @Min(1)
  credits!: number;

  @ApiProperty({ description: 'Price amount in cents', example: 500 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiProperty({ description: 'Currency code', example: 'usd' })
  @IsString()
  @IsNotEmpty()
  currency!: string;
}
