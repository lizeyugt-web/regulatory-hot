// Compare Qwen thinking vs DeepSeek
const https = require('https');
const TOKEN = process.env.SILICONFLOW_API_KEY;
if (!TOKEN) { console.error('no key'); process.exit(1); }

async function probe(model, name) {
  const body = JSON.stringify({
    model: model,
    messages: [{ role: 'user', content: '请返回 JSON: {"ok": true, "msg": "test"}，不要 markdown 包裹。' }],
    max_tokens: 100,
    temperature: 0.3,
  });
  const o = {
    hostname: 'api.siliconflow.cn', port: 443, path: '/v1/chat/completions', method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  return new Promise((resolve) => {
    const r = https.request(o, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) { console.log(name, 'http', res.statusCode, d.slice(0, 200)); resolve(); return; }
        const j = JSON.parse(d);
        const msg = j.choices[0].message;
        console.log('=== ' + name + ' (' + model + ') ===');
        console.log('content_len:', (msg.content || '').length);
        console.log('reasoning_len:', (msg.reasoning_content || '').length);
        console.log('content:', JSON.stringify((msg.content || '').slice(0, 200)));
        resolve();
      });
    });
    r.on('error', e => { console.error(name, 'err', e.message); resolve(); });
    r.write(body); r.end();
  });
}

(async () => {
  await probe('Qwen/Qwen3.5-35B-A3B', 'Qwen');
  await probe('deepseek-ai/DeepSeek-V3.2', 'DeepSeek-V3.2');
  await probe('Qwen/Qwen2.5-72B-Instruct', 'Qwen2.5-72B');
  await probe('Qwen/Qwen2.5-32B-Instruct', 'Qwen2.5-32B');
  await probe('Pro/Qwen/Qwen2.5-7B-Instruct', 'Qwen2.5-7B-Pro');
})();
