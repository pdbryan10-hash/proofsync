import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton. Instantiated lazily and cached on globalThis in
 * development to survive HMR. Never connects at module-eval time, so the
 * production build (`next build`) does not require a live database.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
