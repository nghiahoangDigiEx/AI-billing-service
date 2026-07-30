import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAddonPackageDto {
  @ApiProperty({
    description: 'Add-on package name',
    example: '100 Credits Pack',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
