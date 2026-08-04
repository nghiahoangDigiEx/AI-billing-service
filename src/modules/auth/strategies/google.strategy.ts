import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from '@/modules/auth/services/auth.service';
import { CONFIG_KEYS } from '@/common/constants/config.constants';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env[CONFIG_KEYS.GOOGLE_CLIENT_ID] || 'placeholder',
      clientSecret:
        process.env[CONFIG_KEYS.GOOGLE_CLIENT_SECRET] || 'placeholder',
      callbackURL:
        process.env[CONFIG_KEYS.GOOGLE_CALLBACK_URL] || 'placeholder',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const email = emails?.[0]?.value;
    const avatar = photos?.[0]?.value;
    const displayName =
      (name?.givenName || '') + (name?.familyName ? ' ' + name.familyName : '');

    const user = await this.authService.validateOAuthUser({
      providerId: id,
      email: email || '',
      name: displayName.trim(),
      avatar,
    });

    done(null, user);
  }
}
