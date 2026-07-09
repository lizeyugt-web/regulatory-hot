/**
 * 数据库客户端 — 供采集脚本使用（根目录）
 * 
 * Prisma Client 在 regulatory-hot/node_modules 中生成
 */
const path = require('path');

const REGULATORY_HOT = path.join(__dirname, '..', 'regulatory-hot');
const { PrismaClient } = require(path.join(REGULATORY_HOT, 'node_modules', '@prisma/client'));
const { PrismaLibSql } = require(path.join(REGULATORY_HOT, 'node_modules', '@prisma/adapter-libsql'));

let prisma;

function getPrisma() {
  if (!prisma) {
    const dbPath = path.join(REGULATORY_HOT, 'regulatory.db');
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
