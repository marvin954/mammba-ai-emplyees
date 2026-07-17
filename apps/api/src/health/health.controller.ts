import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaClient } from '@nexusos/database';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaClient) {}

  @Get()
  async check(): Promise<{ status: string; db: string; timestamp: string }> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() };
    }
  }
}
