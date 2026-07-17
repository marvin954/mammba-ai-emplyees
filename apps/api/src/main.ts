import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { MarketplaceService } from './marketplace/marketplace.service.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ThrottleGuard } from './common/guards/throttle.guard.js';
import { Reflector } from '@nestjs/core';

// Validate required environment variables before anything else starts.
// This gives operators a clear error message rather than a cryptic crash later.
function validateEnv(logger: Logger): void {
  const REQUIRED = ['DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_SECRET'] as const;
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check your .env file or deployment configuration.',
    );
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  validateEnv(logger);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env['NODE_ENV'] !== 'production' }),
  );

  // Security
  await app.register(helmet as Parameters<typeof app.register>[0]);
  app.enableCors({
    origin: process.env['APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
  });

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor());
  app.useGlobalGuards(new ThrottleGuard(new Reflector()));

  // Swagger (non-production only)
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NexusOS API')
      .setDescription('Multi-Tenant AI Business Operating System')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Seed official plugins idempotently on every startup
  try {
    const marketplaceService = app.get(MarketplaceService);
    await marketplaceService.seedOfficialPlugins();
    logger.log('Official plugins seeded');
  } catch (err) {
    logger.warn(`Plugin seed failed (non-fatal): ${String(err)}`);
  }

  const port = Number(process.env['PORT'] ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`NexusOS API listening on port ${port}`);
}

void bootstrap();
