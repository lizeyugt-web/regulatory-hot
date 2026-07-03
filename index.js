/**
 * 全球药械监管信息采集监控平台
 * Global Regulatory Intelligence Monitoring Platform
 *
 * 主入口文件
 */

require('dotenv').config();

const DatabaseManager = require('./src/database/manager');
const CrawlEngine = require('./src/crawlers/engine');
const AIAnalyzer = require('./src/analyzer/ai_analyzer');
const Scheduler = require('./src/scheduler/scheduler');
const APIServer = require('./src/api/server');

// 加载配置
const config = require('./config/sources.json');

async function main() {
  console.log('============================================================');
  console.log('  全球药械监管信息采集监控平台');
  console.log('  Global Regulatory Intelligence Monitoring Platform');
  console.log('============================================================');
  console.log('');

  // 1. 初始化数据库
  console.log('[Init] Initializing database...');
  const db = new DatabaseManager();
  await db.init();

  // 2. 初始化采集引擎
  console.log('[Init] Initializing crawl engine...');
  const crawlEngine = new CrawlEngine(config, db);

  // 3. 初始化AI分析器
  console.log('[Init] Initializing AI analyzer...');
  const aiAnalyzer = new AIAnalyzer({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-5'
  });

  // 4. 初始化调度器
  console.log('[Init] Initializing scheduler...');
  const scheduler = new Scheduler(crawlEngine, aiAnalyzer, db);

  // 5. 初始化API服务器
  console.log('[Init] Initializing API server...');
  const apiServer = new APIServer(db, scheduler, {
    port: parseInt(process.env.PORT) || 3456,
    host: process.env.HOST || '0.0.0.0'
  });
  await apiServer.init();

  // 6. 启动调度器 (12小时间隔)
  const intervalHours = parseInt(process.env.CRAWL_INTERVAL_HOURS) || 12;
  scheduler.start(intervalHours);

  // 7. 启动API服务器
  await apiServer.start();

  // 优雅退出
  const shutdown = async (signal) => {
    console.log(`\n[Shutdown] Received ${signal}, shutting down...`);
    scheduler.stop();
    await apiServer.stop();
    db.close();
    console.log('[Shutdown] Done.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('');
  console.log('============================================================');
  console.log('  Platform is running!');
  console.log(`  Web UI: http://localhost:${apiServer.port}`);
  console.log(`  Crawl Interval: Every ${intervalHours} hours`);
  console.log(`  AI Analysis: ${aiAnalyzer.apiKey ? 'Claude API' : 'Rule Engine (fallback)'}`);
  console.log('============================================================');
}

main().catch(error => {
  console.error('[Fatal] Failed to start:', error);
  process.exit(1);
});
