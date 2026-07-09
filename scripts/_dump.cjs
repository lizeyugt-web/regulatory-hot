const fs = require('fs');
const data = JSON.parse(fs.readFileSync('regulatory-hot/public/data/events.json', 'utf8'));
console.log('stats:', JSON.stringify(data.stats));
const w = data.items.filter(x => x._source === 'wechat' && x.aiSummaryCn && x.aiSummaryCn.length > 0);
console.log('wechat with aiSummaryCn:', w.length);
if (w[0]) {
  console.log('---');
  console.log('title=' + w[0].title);
  console.log('source=' + w[0].sourceName);
  console.log('aiSummaryCn=' + w[0].aiSummaryCn);
  console.log('aiReason=' + w[0].aiReason);
  console.log('finalScore=' + w[0].finalScore);
  console.log('scores=' + JSON.stringify(w[0].scores));
}
