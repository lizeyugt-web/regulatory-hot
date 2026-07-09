/**
 * FDA 采集入口脚本 — v2.0 直写数据库版
 *
 * 用法: node scripts/collect_fda.cjs
 * 输出: regulatory-hot/regulatory.db (SQLite)
 *
 * 可加 --rss-only 只跑 RSS（快速测试，无需 Playwright）
 * 可加 --no-ai 跳过采集后的 AI 自动分析
 */
const FDACollector = require('../src/crawlers/fda_collector.js');
const { spawn } = require('child_process');
const path = require('path');
const { fdaToDb, insertEvents, logCrawl, disconnectPrisma } = require('./db_writer.cjs');

async function main() {
  const args = process.argv.slice(2);
  const rssOnly = args.includes('--rss-only');
  const noAi = args.includes('--no-ai');
  const startTime = Date.now();

  const collector = new FDACollector({
    outputDir: path.join(__dirname, '..', 'regulatory-hot', 'public', 'data'),
  });

  // 劫持 saveEventsJSON → 写数据库
  const origSaveJSON = collector.saveEventsJSON.bind(collector);
  collector.saveEventsJSON = function(events) {
    // 仍保存 JSON 作为备份
    origSaveJSON(events);
    // 同时写入数据库
    return saveToDb(events, 'FDA');
  };

  // 也劫持 saveEventsJSON 引用（run 内部可能用别名）
  const saveKey = 'saveEventsJSON';
  collector[saveKey] = collector.saveEventsJSON;

  let events = [];

  if (rssOnly) {
    console.log('============================================================');
    console.log('  FDA 采集 — RSS Only 模式 (DB v2.0)');
    console.log('============================================================\n');

    let allItems = [];
    const rssItems = await collector.collectRSS();
    allItems.push(...rssItems);
    const frItems = await collector.collectFederalRegister();
    allItems.push(...frItems);

    const unique = collector.deduplicate(allItems);
    events = collector.transformToEvents(unique);
    events.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    if (events.length > 0 && events[0].selected) events[0].isLead = true;
    collector.saveEventsJSON(events);

    console.log('\n✅ RSS Only 完成!\n');
  } else {
    const result = await collector.run();
    events = result.events || [];
  }

  // 写数据库
  const dbEvents = events.map(fdaToDb);
  const dbResult = await saveToDb(events, 'FDA');

  // 采集日志
  await logCrawl('fda', {
    startedAt: new Date(startTime).toISOString(),
    status: 'success',
    total: events.length,
    inserted: dbResult.inserted,
    skipped: dbResult.skipped,
    durationMs: Date.now() - startTime,
  });

  // 断开数据库
  await disconnectPrisma();

  // 采集完成后自动触发 AI 分析
  if (!noAi) {
    console.log('\n============================================================');
    console.log('  🧠 自动触发 AI 分析...');
    console.log('============================================================\n');
    await runAiAnalysis();
  } else {
    console.log('\n⏭️  跳过 AI 分析 (--no-ai)');
  }
}

async function saveToDb(events, label) {
  const dbEvents = events.map(fdaToDb);
  console.log(`\n[DB] 写入 ${dbEvents.length} 条 ${label} 事件...`);
  const result = await insertEvents(dbEvents);
  console.log(`[DB] ✓ 新增 ${result.inserted} 条, 跳过 ${result.skipped} 条`);
  return result;
}

function runAiAnalysis() {
  return new Promise((resolve) => {
    const analyzePath = path.join(__dirname, 'analyze.cjs');
    const child = spawn('node', [analyzePath, '--limit', '50'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => {
      console.log(code === 0 ? '\n✅ AI 分析完成！' : `\n⚠️  AI 分析退出码: ${code}`);
      resolve();
    });
    child.on('error', (err) => {
      console.log(`\n⚠️  AI 分析启动失败: ${err.message}`);
      resolve();
    });
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
