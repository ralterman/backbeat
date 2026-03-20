import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Use a module-level variable but defer construction to first use
let _prisma: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // During build/static generation DATABASE_URL may not be set;
    // return a client that will fail at query time with a clear message.
    console.warn("DATABASE_URL is not set – Prisma client will not connect.");
    // Still create a client (it won't be called during build)
    const adapter = new PrismaPg({ connectionString: "postgresql://localhost/placeholder" });
    return new PrismaClient({ adapter });
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = createPrismaClient();
  }
  return _prisma;
}

// Convenience export for direct use
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
