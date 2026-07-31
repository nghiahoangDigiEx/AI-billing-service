import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
    jest.spyOn(configService, 'get').mockReturnValue('test-secret');
    strategy = new JwtStrategy(configService);
  });

  describe('validate', () => {
    it('returns user object based on payload', () => {
      const payload = { sub: '123', email: 'test@test.com', role: 'USER' };
      const result = strategy.validate(payload);

      expect(result).toEqual({
        id: '123',
        email: 'test@test.com',
        role: 'USER',
      });
    });
  });
});
