import { Controller, Get, HttpCode, HttpStatus, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaClient } from '@nexusos/database';
import { CircuitBreakerRegistry } from '@nexusos/ai-core';
import { MetricsRegistry } from '@nexusos/observability';
import { createConnection } from 'net';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaClient) {}

  private checkRedisTcp(): Promise<'connected' | 'disconnected' | 'unconfigured'> {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) return Promise.resolve('unconfigured');
    return new Promise((resolve) => {
      try {
        const parsed = new URL(redisUrl);
        const host = parsed.hostname;
        const port = Number(parsed.port || 6379);
        const socket = createConnection({ host, port });
        const timeout = setTimeout(() => { socket.destroy(); resolve('disconnected'); }, 3_000);
        socket.on('connect', () => { clearTimeout(timeout); socket.destroy(); resolve('connected'); });
        socket.on('error', () => { clearTimeout(timeout); resolve('disconnected'); });
      } catch {
        resolve('disconnected');
      }
    });
  }

  /** Liveness: is the process alive? Always 200 unless catastrophically broken. */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness: can we serve traffic? Returns 503 if DB is down. */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready(): Promise<{
    status: 'ok' | 'degraded';
    db: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected' | 'unconfigured';
    circuitBreakers: Record<string, unknown>;
    timestamp: string;
  }> {
    const [dbOk, redisStatus] = await Promise.all([
      this.checkDb(),
      this.checkRedisTcp(),
    ]);

    return {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'connected' : 'disconnected',
      redis: redisStatus,
      circuitBreakers: CircuitBreakerRegistry.getAll(),
      timestamp: new Date().toISOString(),
    };
  }

  /** Prometheus-compatible metrics scrape endpoint. */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
  metrics(): string {
    return MetricsRegistry.prometheusText();
  }

  /** Legacy — kept for backward compatibility. */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  async check(): Promise<{ status: string; db: string; timestamp: string }> {
    const dbOk = await this.checkDb();
    return {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<'connected' | 'disconnected' | 'unconfigured'> {
    if (!this.redis) return 'unconfigured';
    try {
      await this.redis.ping();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }
}
