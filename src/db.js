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
  if (fs.existsSync(subPath)) return require(subPath);
  const rootPath = path.join(ROOT, 'node_modules', name);
  if (fs.existsSync(rootPath)) return require(rootPath);
  throw new Error(`Cannot find module: ${name} (tried ${subPath} and ${rootPath})`);
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
