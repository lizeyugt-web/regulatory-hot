/**
 * 数据库客户端 — 单例 (Next.js / ESM)
 *
 * 稳定性配置:
 * - WAL 模式: 允许并发读写
 * - busy_timeout=5000: 等待锁最多 5s，不立即报错
 * - synchronous=NORMAL: 平衡性能和安全
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL
  || `file:${path.join(process.cwd(), 'regulatory.db')}?mode=rwc&_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL`;

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createPrisma() {
  const adapter = new PrismaLibSql({ url: DB_PATH });
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.__prisma || createPrisma();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

export default prisma;
