import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: requiredEnv('JWT_ACCESS_SECRET') });
  }
  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') return false;
    return this.authService.validateAccessUser(payload.sub, payload.sessionVersion);
  }
}

function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} environment variable must be set.`); return value; }
