import { Injectable, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err ?? !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
