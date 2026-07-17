import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    (req as FastifyRequest & { requestId: string }).requestId = requestId;
    void reply.header('x-request-id', requestId);

    return next.handle();
  }
}
