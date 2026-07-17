import {
  Injectable,
  Logger,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { Metrics } from '@nexusos/observability';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest & { requestId?: string }>();
    const { method, url, requestId } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
        this.logger.log(`${method} ${url} ${status} ${ms}ms [${requestId ?? '-'}]`);
        Metrics.httpRequestsTotal.inc({ method, status: String(status) });
        Metrics.httpRequestDurationMs.observe(ms, { method });
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        this.logger.warn(`${method} ${url} ERR ${ms}ms [${requestId ?? '-'}] ${String(err)}`);
        Metrics.httpRequestsTotal.inc({ method, status: 'error' });
        return throwError(() => err);
      }),
    );
  }
}
