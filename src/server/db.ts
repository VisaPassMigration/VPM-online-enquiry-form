import { PrismaClient } from '@prisma/client';

/**
 * Internal backend-only Prisma helper.
 * Lazily creates Prisma so Next/Vercel can import route modules during build
 * without opening or validating a database connection immediately.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let prisma: PrismaClient | undefined = globalForPrisma.prisma;

const getPrismaClient = () => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prisma;
    }
  }

  return prisma;
};

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);

    return typeof value === 'function' ? value.bind(client) : value;
  },
});
