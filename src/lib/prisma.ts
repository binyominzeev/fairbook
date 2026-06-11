import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const rel = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
  const dbPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rel);

  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
