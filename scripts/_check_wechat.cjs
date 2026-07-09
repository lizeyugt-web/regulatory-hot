const fs = require('fs');
const data = JSON.parse(fs.readFileSync('regulatory-hot/public/data/events.json', 'utf8'));
const w = data.items.filter(x => x._source === 'wechat');
console.log('total wechat:', w.length);
// 看每个 wechat 的 analyzedAt 是否被设置
let count = 0;
const timeMap = new Map();
for (const item of w) {
  if (item.aiAnalyzedAt) {
    const t = item.aiAnalyzedAt.slice(0, 19);
    timeMap.set(t, (timeMap.get(t) || 0) + 1);
  }
}
console.log('analyzedAt times:', Array.from(timeMap.entries()).sort());
console.log('---');
console.log('items with aiSummaryCn:', w.filter(x => x.aiSummaryCn && x.aiSummaryCn.length > 0).length);
console.log('items with aiReason:', w.filter(x => x.aiReason && x.aiReason.length > 0).length);
console.log('items with parsed.scores:', w.filter(x => x.scores && (x.scores.sourceAuthority || 0) > 0).length);
