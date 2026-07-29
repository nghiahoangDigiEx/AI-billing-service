import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, Provider } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ enum: Provider })
  provider!: Provider;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
