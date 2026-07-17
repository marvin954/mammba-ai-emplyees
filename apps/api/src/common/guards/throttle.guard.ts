import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  /** max requests per window */
  limit: number;
  /** window in seconds */
  ttl: number;
}

export const Throttle = (opts: ThrottleOptions) =>
  (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(THROTTLE_KEY, opts, descriptor.value as object);
    } else {
      Reflect.defineMetadata(THROTTLE_KEY, opts, target);
    }
    return descriptor ?? target;
  };

interface HitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly store = new Map<string, HitRecord>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private readonly reflector: Reflector) {
    // Prune expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, rec] of this.store) {
        if (rec.resetAt <= now) this.store.delete(key);
      }
    }, 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<ThrottleOptions | undefined>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No throttle decoration → allow
    if (!opts) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest & { user?: { sub?: string; orgId?: string } }>();
    // Prefer org-scoped key, fall back to IP
    const identity =
      req.user?.orgId ?? req.user?.sub ?? req.ip ?? 'unknown';
    const handlerKey = `${context.getClass().name}:${context.getHandler().name}`;
    const key = `${handlerKey}:${identity}`;

    const now = Date.now();
    const windowMs = opts.ttl * 1_000;

    const rec = this.store.get(key);
    if (!rec || rec.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    rec.count += 1;
    if (rec.count > opts.limit) {
      const retryAfter = Math.ceil((rec.resetAt - now) / 1_000);
      throw new HttpException(`Rate limit exceeded. Retry after ${retryAfter}s.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
