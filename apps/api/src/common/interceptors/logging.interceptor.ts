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
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        this.logger.warn(`${method} ${url} ERR ${ms}ms [${requestId ?? '-'}] ${String(err)}`);
        return throwError(() => err);
      }),
    );
  }
}
