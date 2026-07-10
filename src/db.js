/**
 * 数据库客户端 — 供采集脚本使用（根目录）
 * 
 * Prisma Client 可能在 regulatory-hot/node_modules 或根 node_modules
 * （取决于 npm install 在哪个目录执行）
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SUB = path.join(ROOT, 'regulatory-hot');

function resolveModule(name) {
  const subPath = path.join(SUB, 'node_modules', name);
  const rootPath = path.join(ROOT, 'node_modules', name);
  // try-catch 处理 npm 安装中断留下的半成品目录
  try { return require(subPath); } catch {}
  try { return require(rootPath); } catch {}
  throw new Error(`Cannot find module: ${name} (tried sub and root node_modules)`);
}

const { PrismaClient } = resolveModule('@prisma/client');
const { PrismaLibSql } = resolveModule('@prisma/adapter-libsql');

let prisma;

function getPrisma() {
  if (!prisma) {
    const dbPath = path.join(SUB, 'regulatory.db');
    const adapter = new PrismaLibSql({ url: 'file:' + dbPath });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

module.exports = { getPrisma, disconnectPrisma };
