/**
 * 数据库客户端 — 单例 (Next.js / ESM)
 *
 * 稳定性配置：
 * - WAL 模式: libsql 默认启用
 * - 同步模式: NORMAL（平衡性能和安全）
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL
  || `file:${path.join(process.cwd(), 'regulatory.db')}`;

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createPrisma() {
  const adapter = new PrismaLibSql({
    url: DB_PATH,
  });
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.__prisma || createPrisma();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

// 启动时执行 PRAGMA，提升并发稳定性
prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL').catch(() => {});
prisma.$executeRawUnsafe('PRAGMA busy_timeout=5000').catch(() => {});
prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL').catch(() => {});

export default prisma;
