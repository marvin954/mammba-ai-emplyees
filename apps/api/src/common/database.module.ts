import { Module, Global } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        const prisma = new PrismaClient({
          log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
        });
        return prisma;
      },
    },
  ],
  exports: [PrismaClient],
})
export class DatabaseModule {}
