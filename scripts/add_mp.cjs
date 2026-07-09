/**
 * 手动添加公众号到监控列表
 *
 * 用法：
 *   node scripts/add_mp.cjs "公众号名称" "fakeid" [category] [level]
 *
 * 示例：
 *   node scripts/add_mp.cjs "医药新观察" "MjM5OTk2MDA0NA==" regulation T1
 *
 * 默认 category=insight, level=T2
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const MP_WATCH_FILE = path.join(PROJECT_ROOT, 'config', 'mp_watch.json');
const FAKEID_CACHE_FILE = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');

const name = process.argv[2];
const fakeid = process.argv[3];
const category = process.argv[4] || 'insight';
const level = process.argv[5] || 'T2';

if (!name || !fakeid) {
  console.error('用法: node scripts/add_mp.cjs "公众号名称" "fakeid" [category] [level]');
  console.error('示例: node scripts/add_mp.cjs "医药新观察" "MjM5OTk2MDA0NA=="');
  process.exit(1);
}

// 更新 mp_watch.json
const watchList = JSON.parse(fs.readFileSync(MP_WATCH_FILE, 'utf-8'));
const exists = watchList.accounts.find(a => a.name === name);
if (exists) {
  console.log(`[SKIP] "${name}" 已在监控列表中`);
} else {
  watchList.accounts.push({ name, category, level, country: 'CN', desc: '手动添加' });
  watchList._last_updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(MP_WATCH_FILE, JSON.stringify(watchList, null, 2) + '\n');
  console.log(`[OK] "${name}" 已加入监控列表 (${category}/${level})`);
}

// 更新 mp_fakeid_cache.json
const fakeidCache = JSON.parse(fs.readFileSync(FAKEID_CACHE_FILE, 'utf-8'));
fakeidCache[name] = fakeid;
fs.writeFileSync(FAKEID_CACHE_FILE, JSON.stringify(fakeidCache, null, 2) + '\n');
console.log(`[OK] fakeid 已缓存: ${fakeid}`);

console.log('\n完成！git push 后 watcher 会在下个周期自动采集。');
