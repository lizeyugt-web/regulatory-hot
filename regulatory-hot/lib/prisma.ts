/**
 * 数据库客户端 — 单例 (Next.js / ESM)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'regulatory.db')}`;

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createPrisma() {
  const adapter = new PrismaLibSql({ url: DB_PATH });
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.__prisma || createPrisma();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

export default prisma;
