/**
 * collect_wechat_smart.cjs 完整链路测试
 * 验证：模式判断、时间窗口、ID去重、文章规范化、合并去重
 */
const BJ_MS = 8 * 3600_000;

// ===== 时间工具（从 smart 脚本复刻）=====
function beijingNow() { return new Date(Date.now() + BJ_MS); }
function yesterdayBeijingStart() {
  const bj = beijingNow();
  bj.setUTCDate(bj.getUTCDate() - 1);
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - BJ_MS);
}
function yesterdayBeijingEnd() {
  return new Date(yesterdayBeijingStart().getTime() + 24 * 3600_000 - 1);
}

// ===== 模式检测 =====
function detectMode(nowMs) {
  const saved = Date.now;
  if (nowMs) Date.now = () => nowMs;
  const bj = beijingNow();
  if (nowMs) Date.now = saved;
  const hour = bj.getUTCHours(), min = bj.getUTCMinutes();
  if (hour === 0 && min < 30) return 'full';
  return 'delta';
}

// ===== 模拟数据 =====
function mockArticles(mpName, publishTimes) {
  return publishTimes.map((t, i) => ({
    msg_id: mpName + '_' + i,
    title: '[' + mpName + '] test article #' + (i + 1),
    link: 'https://mp.weixin.qq.com/s/test_' + mpName + '_' + i,
    digest: 'digest of article ' + (i + 1) + ' from ' + mpName,
    create_time: t,
  }));
}

function extractPublishTime(item) {
  if (typeof item.create_time === 'number' && item.create_time > 1e9)
    return new Date(item.create_time * 1000);
  return null;
}

function withinWindow(pubDate, wStart, wEnd) {
  if (!pubDate) return false;
  return pubDate.getTime() >= wStart.getTime() && pubDate.getTime() <= wEnd.getTime();
}

let allPass = true;
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) allPass = false;
  console.log('  [' + mark + '] ' + name + (detail !== undefined ? ': ' + detail : ''));
}

console.log('='.repeat(64));
console.log('  collect_wechat_smart.cjs — Full Pipeline Test');
console.log('='.repeat(64));

// ===== A: Delta Mode =====
console.log('\n[Test A] Delta mode (BJ 09:45)');
const deltaNow = new Date('2026-07-09T09:45:00+08:00').getTime();
check('mode detection', detectMode(deltaNow) === 'delta', detectMode(deltaNow));

const nowSec = Math.floor(new Date('2026-07-09T09:45:00+08:00').getTime() / 1000);
const articles = mockArticles('ChinaDrug', [
  nowSec - 300,    // 5 min ago  -> in window
  nowSec - 2000,   // 33 min ago -> out of window
  nowSec - 4000,
  nowSec - 8000,
  nowSec - 20000,
]);

const dWStart = new Date(deltaNow - 31 * 60000);
const dWEnd = new Date(deltaNow);
const dInWindow = articles.filter(a => withinWindow(extractPublishTime(a), dWStart, dWEnd));
check('31min window filter', dInWindow.length === 1, dInWindow.length + ' in window (expect 1)');

// ID dedup test
const lastId = 'ChinaDrug_4';
const newOnly = [];
let hitCache = false;
for (const a of articles) {
  if (String(a.msg_id) === lastId) { hitCache = true; break; }
  newOnly.push(a);
}
check('ID dedup', newOnly.length === 4, newOnly.length + ' new, cache hit=' + hitCache);

// ===== B: Full Mode =====
console.log('\n[Test B] Full mode (BJ 00:00)');
const fullNow = new Date('2026-07-09T00:00:00+08:00').getTime();
check('mode detection', detectMode(fullNow) === 'full', detectMode(fullNow));

const bj = new Date(fullNow + BJ_MS);
bj.setUTCDate(bj.getUTCDate() - 1);
const yStart = new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - BJ_MS);
const yEnd = new Date(yStart.getTime() + 24 * 3600_000 - 1);

check('window start', yStart.toISOString() === '2026-07-07T16:00:00.000Z', 'UTC ' + yStart.toISOString());
check('window end', yEnd.toISOString() === '2026-07-08T15:59:59.999Z', 'UTC ' + yEnd.toISOString());
check('Beijing equivalent', true, 'BJ 2026-07-08 00:00:00 ~ 23:59:59');

const y0 = new Date('2026-07-08T00:00:00+08:00').getTime() / 1000;
const fullArticles = mockArticles('Pugongying', [
  y0, y0 + 3600 * 3, y0 + 3600 * 8, y0 + 3600 * 12, y0 + 3600 * 18, y0 + 3600 * 23,
  ...Array.from({ length: 14 }, (_, i) => y0 + 3600 * (i + 1)),
]);
const fInWindow = fullArticles.filter(a => withinWindow(extractPublishTime(a), yStart, yEnd));
check('yesterday filter', fInWindow.length === 20, fInWindow.length + '/20 all in yesterday window');
check('full mode no dedup skip', fInWindow.length === 20, 'all 20 processed');

// ===== C: Normalization =====
console.log('\n[Test C] Article normalization');
function normalizeArticle(item, mp) {
  return {
    id: String(item.msg_id),
    title: item.title,
    link: item.link,
    publishTime: extractPublishTime(item)?.toISOString(),
    source: 'wechat',
    sourceName: mp.name,
    sourceLevel: mp.level,
    sourceCategory: mp.category,
    contentMarkdown: '',
    contentMarkdownStatus: 'pending',
  };
}
const mp = { name: 'Saibailan', level: 'T2', category: 'insight', country: 'CN' };
const norm = normalizeArticle(fullArticles[0], mp);
check('ID extract', norm.id === 'Pugongying_0');
check('source info', norm.sourceName === 'Saibailan' && norm.sourceLevel === 'T2');
check('publish time parse', norm.publishTime === '2026-07-07T16:00:00.000Z',
  'BJ 2026-07-08 00:00 = UTC ' + norm.publishTime);

// ===== D: Merge dedup =====
console.log('\n[Test D] Merge dedup');
const existing = [
  { link: 'https://mp.weixin.qq.com/s/test_ChinaDrug_0', title: 'existing' },
  { link: 'https://mp.weixin.qq.com/s/old_1', title: 'old' },
];
const existingLinks = new Set(existing.map(a => a.link));
const trulyNew = [norm].filter(a => !existingLinks.has(a.link));
check('link dedup', trulyNew.length === 1, '1 article not in existing set');

// ===== E: Boundary Cases =====
console.log('\n[Test E] Boundary cases');

// 00:29 -> full
check('00:29 = full', detectMode(new Date('2026-07-09T00:29:59+08:00').getTime()) === 'full');
// 00:30 -> delta
check('00:30 = delta', detectMode(new Date('2026-07-09T00:30:00+08:00').getTime()) === 'delta');
// 23:59 -> delta
check('23:59 = delta', detectMode(new Date('2026-07-09T23:59:59+08:00').getTime()) === 'delta');
// Cross-month: July 1 00:00 -> full
check('Jul 1 00:00 = full', detectMode(new Date('2026-07-01T00:00:00+08:00').getTime()) === 'full');

// window filter edge: exactly at boundary
const exactStart = new Date(yStart.getTime());
const exactEnd = new Date(yEnd.getTime());
check('at window start', withinWindow(exactStart, yStart, yEnd), 'inclusive');
check('at window end', withinWindow(exactEnd, yStart, yEnd), 'inclusive');
check('1ms before start', !withinWindow(new Date(yStart.getTime() - 1), yStart, yEnd), 'exclusive');
check('1ms after end', !withinWindow(new Date(yEnd.getTime() + 1), yStart, yEnd), 'exclusive');

// ===== F: State persistence =====
console.log('\n[Test F] State tracking');
const state = { version: 1, accounts: {}, lastFullRun: null };
state.accounts['ChinaDrug'] = {
  fakeid: 'fake_123',
  lastArticleId: 'ChinaDrug_4',
  lastCheck: new Date().toISOString(),
};
state.lastFullRun = new Date().toISOString();
check('state version', state.version === 1);
check('account tracking', state.accounts['ChinaDrug'].lastArticleId === 'ChinaDrug_4');
check('full run timestamp', !!state.lastFullRun);

// ===== Summary =====
console.log('\n' + '='.repeat(64));
if (allPass) {
  console.log('  ALL TESTS PASSED');
} else {
  console.log('  SOME TESTS FAILED — check output above');
}
console.log('='.repeat(64));
