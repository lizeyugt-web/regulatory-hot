/**
 * FDA 采集入口脚本 — GitHub Actions 兼容版
 *
 * 用法: node scripts/collect_fda.cjs
 * 输出: regulatory-hot/public/data/events.json
 *
 * 可加 --rss-only 只跑 RSS（快速测试，无需 Playwright）
 * 可加 --no-ai 跳过采集后的 AI 自动分析
 */

const FDACollector = require('../src/crawlers/fda_collector.js');
const { spawn } = require('child_process');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const rssOnly = args.includes('--rss-only');
  const noAi = args.includes('--no-ai');

  const collector = new FDACollector({
    outputDir: path.join(__dirname, '..', 'regulatory-hot', 'public', 'data'),
  });

  if (rssOnly) {
    // 快速模式：只跑 RSS + FR，跳过 Web（无需 Playwright）
    console.log('============================================================');
    console.log('  FDA 采集 — RSS Only 模式');
    console.log('============================================================\n');

    let allItems = [];
    const rssItems = await collector.collectRSS();
    allItems.push(...rssItems);
    const frItems = await collector.collectFederalRegister();
    allItems.push(...frItems);

    const unique = collector.deduplicate(allItems);
    const events = collector.transformToEvents(unique);
    events.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    if (events.length > 0 && events[0].selected) events[0].isLead = true;
    collector.saveEventsJSON(events);

    console.log('\n✅ RSS Only 完成!\n');
  } else {
    await collector.run();
  }

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

/**
 * 运行 AI 分析脚本
 */
function runAiAnalysis() {
  return new Promise((resolve, reject) => {
    const analyzePath = path.join(__dirname, 'analyze.cjs');
    const child = spawn('node', [analyzePath, '--limit', '50'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ AI 分析完成！');
        resolve();
      } else {
        console.log(`\n⚠️  AI 分析退出码: ${code}（采集数据已保存，可稍后手动运行 node scripts/analyze.cjs）`);
        resolve(); // 不因 AI 分析失败而阻断采集
      }
    });

    child.on('error', (err) => {
      console.log(`\n⚠️  AI 分析启动失败: ${err.message}`);
      resolve(); // 降级
    });
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
