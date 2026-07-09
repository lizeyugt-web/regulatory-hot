// Probe Qwen model real response format
const https = require('https');
const TOKEN = process.env.SILICONFLOW_API_KEY;
if (!TOKEN) { console.error('no SILICONFLOW_API_KEY'); process.exit(1); }

const prompt = '你是全球医药监管情报分析专家。请分析以下监管相关信息。\u3000重点关注：国内监管政策变化、行业动态、合规要点、对药企的实际影响。\n\n【原始信息】\n标题：国大药房，董事长换人\n原始摘要：2026年7月1日，国大药房发生董事长人事变动。\n来源：赛柏蓝\n分类：insight\n\n原文内容：# 国大药房董事长换人\n## 事件\n国大药房是国内最大的药品零售连锁之一。\n## 影响\n这次变动反映了零售药商业务重构。\n\n请返回 JSON（直接输出，不要 markdown 代码块）：\n{\n  "titleCn": "准确、专业的中文标题（20字以内）",\n  "aiSummaryCn": "中文摘要（150-250字），提炼文章核心观点",\n  "aiReason": "推荐理由（1-2句话）",\n  "scores": {\n    "sourceAuthority": 0,\n    "impactScope": 0,\n    "timeliness": 0,\n    "complianceUrgency": 0,\n    "industryAttention": 0\n  }\n}';

const body = JSON.stringify({
  model: 'Qwen/Qwen3.5-35B-A3B',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 600,
  temperature: 0.3,
});

const o = {
  hostname: 'api.siliconflow.cn', port: 443, path: '/v1/chat/completions', method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const r = https.request(o, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('=== HTTP status ===', res.statusCode);
    if (res.statusCode !== 200) {
      console.log('BODY:', d);
      return;
    }
    const j = JSON.parse(d);
    const msg = j.choices[0].message;
    console.log('=== content (raw, length=' + (msg.content || '').length + ') ===');
    console.log(msg.content);
    console.log('=== reasoning_content (truncated) ===');
    console.log((msg.reasoning_content || '(none)').slice(0, 300));
  });
});
r.on('error', e => console.error('err:', e.message));
r.write(body);
r.end();
