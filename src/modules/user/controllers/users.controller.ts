import { ApiStandardResponse } from '@/common/decorators/api-standard-response.decorator';
import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@/modules/user/services/user.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { UpdateProfileDto } from '@/modules/user/dto/update-profile.dto';
import { UpdateRoleDto } from '@/modules/user/dto/update-role.dto';
import { UserResponseDto } from '@/modules/user/dto/user-response.dto';
import { Role } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Returns the current user profile.',
    type: UserResponseDto,
  })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.userService.getProfile(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully.',
    type: UserResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, updateProfileDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Returns all users.',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requires ADMIN role.',
  })
  async findAll() {
    return this.userService.findAll();
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Role updated successfully.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requires ADMIN role.',
  })
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(id, updateRoleDto.role);
  }
}
