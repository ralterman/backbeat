import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  let url = process.env.DATABASE_URL;
  if (!url) {
    // Build time (e.g. Vercel Preview without a database): Prisma 7 refuses
    // `new PrismaClient()` with no adapter, so give it one pointing at a
    // placeholder. pg pools connect lazily, so nothing happens until the
    // first query, which then fails with a connection error.
    console.warn("DATABASE_URL not set — Prisma will not connect.");
    url = "postgresql://unset:unset@127.0.0.1:5432/unset";
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient());
