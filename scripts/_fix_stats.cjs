// 修正 events.json 的 stats 字段（aiCompleted / aiPending / wechatTotal）
const fs = require('fs');
const path = 'regulatory-hot/public/data/events.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const items = data.items || [];
const aiCompleted = items.filter(x => x.aiSummaryCn && x.aiSummaryCn.length > 0).length;
const wechatTotal = items.filter(x => x._source === 'wechat').length;
data.stats = {
  ...data.stats,
  total: items.length,
  aiCompleted,
  aiPending: items.length - aiCompleted,
  wechatTotal,
};
data.updated = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('updated stats:', JSON.stringify(data.stats));
