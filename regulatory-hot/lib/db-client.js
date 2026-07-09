/**
 * 数据库客户端 — 单例
 * 
 * 用于 Next.js API Routes 和采集脚本（require 方式）
 * Prisma 7.x + SQLite (via libsql adapter)
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const path = require('path');

// 数据库文件路径（相对于 regulatory-hot 项目根目录）
const DB_PATH = process.env.DATABASE_URL || 'file:./regulatory.db';

let prisma;

function getPrisma() {
  if (!prisma) {
    const adapter = new PrismaLibSql({ url: DB_PATH });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

module.exports = { getPrisma, DB_PATH };
