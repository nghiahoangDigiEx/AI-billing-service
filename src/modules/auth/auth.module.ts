import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { StringValue } from 'ms';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { GoogleStrategy } from '@/modules/auth/strategies/google.strategy';
import { AuthService } from '@/modules/auth/services/auth.service';
import { AuthController } from '@/modules/auth/controllers/auth.controller';
import { UserModule } from '@/modules/user/user.module';
import { CONFIG_KEYS } from '@/common/constants/config.constants';

@Module({
  imports: [
    UserModule,
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(CONFIG_KEYS.JWT_SECRET),
        signOptions: {
          expiresIn: configService.get<number | StringValue>(
            CONFIG_KEYS.JWT_EXPIRES_IN,
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
