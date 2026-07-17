import { PrismaClient } from './generated/prisma/index.js';

// Singleton pattern for Prisma client — prevents connection pool exhaustion in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient } from './generated/prisma/index.js';
export * from './generated/prisma/index.js';
