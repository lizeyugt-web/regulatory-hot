/**
 * AI 分析脚本 v3.0 — 数据库版
 *
 * 从 SQLite 读 pending 事件 → AI 分析 → 写回数据库
 * 根据 titleLang 智能判断是否需要翻译
 *
 * 用法:
 *   node scripts/analyze_v3.cjs                 # 分析所有 pending
 *   node scripts/analyze_v3.cjs --limit 20      # 只分析 N 条
 *   node scripts/analyze_v3.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');
const { getPrisma, disconnectPrisma } = require('../src/db');

// ===== Load env =====
function loadEnv(file) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
    }
  } catch (e) { /* noop */ }
}
loadEnv(path.join(__dirname, '..', 'regulatory-hot', '.env'));

// ===== AI Config（统一走 config/ai-models.json → WorkBuddy 积分反代）=====
const { getModuleConfig } = require('./ai_config.cjs');
const ANALYZE_CFG = getModuleConfig('analyze');
const TRANSLATE_CFG = getModuleConfig('translate');
const AI = {
  baseUrl: ANALYZE_CFG.baseUrl,
  apiKey: ANALYZE_CFG.apiKey,
  model: ANALYZE_CFG.model,
  translateModel: TRANSLATE_CFG.model,
  concurrency: parseInt(process.env.AI_CONCURRENCY || '8'),
  maxTokens: 600,
  temperature: 0.3,
  maxRetries: ANALYZE_CFG.maxRetries || 2,
};

// ===== Utilities =====
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function estimateTokens(text) {
  if (!text) return 0;
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.ceil(cn / 1.5 + (text.length - cn) / 4);
}

async function chatCompletion(messages, opts = {}) {
  const { model = AI.model, maxTokens = 1024, temperature = 0.3 } = opts;
  if (!AI.apiKey) throw new Error('反代 API Key 未配置（config/ai-models.json provider.apiKey）');

  for (let attempt = 0; attempt < AI.maxRetries; attempt++) {
    try {
      const res = await fetch(`${AI.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI.apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      });
      if (!res.ok) {
        if (res.status === 429) { await sleep((attempt + 1) * 2000); continue; }
        throw new Error(`API ${res.status}`);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message || {};
      const content = msg.content || msg.reasoning_content || '';
      return {
        content,
        usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0 },
        model: data.model || AI.model,
      };
    } catch (err) {
      if (attempt < AI.maxRetries - 1) { await sleep((attempt + 1) * 1000); continue; }
      throw err;
    }
  }
}

// ===== AI: 翻译标题 + 生成摘要 + 五维评分 =====
function buildPrompt(event) {
  const isChinese = event.titleLang === 'zh';
  const titleToUse = isChinese ? event.titleOriginal : event.titleCn || event.titleOriginal;

  return `你是全球医药监管情报分析专家。请分析以下医药监管信息：

【原始信息】
标题：${titleToUse}
摘要：${(event.summaryOriginal || '').slice(0, 500)}
${!isChinese ? '（注意：原文为非中文，请先翻译标题为中文）' : ''}

请完成以下任务并输出 JSON：
{
  "titleCn": "${isChinese ? titleToUse : '请翻译为中文'}",
  "summaryCn": "150-250字中文摘要，包含核心内容和影响",
  "reason": "1-2句推荐理由，说明为什么值得关注",
  "scores": {
    "sourceAuthority": 0-100,
    "impactScope": 0-100,
    "timeliness": 0-100,
    "complianceUrgency": 0-100,
    "industryAttention": 0-100
  }
}

评分标准：
- sourceAuthority: FDA/EMA等T1官方=85-100, T2媒体=60-80
- impactScope: 全球影响=90+, 区域=60-80, 局部=40-60
- timeliness: 当日=90+, 本周=70-85, 更早=50-70
- complianceUrgency: 强制性法规/召回=85+, 指南草案=60-80, 一般=40-60
- industryAttention: 重大突破=90+, 热点话题=70-85, 常规=40-60

只输出 JSON，不要解释。`;
}

function buildTranslatePrompt(event) {
  return `请将以下英文医药监管信息正文翻译为专业的中文。保持术语准确，语句通顺。

标题：${event.titleCn || event.titleOriginal}

正文：
${(event.contentOriginal || '').slice(0, 8000)}

请只输出翻译后的中文正文，不要任何解释。`;
}

function parseAnalysisAI(content) {
  try {
    const clean = content.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      titleCn: parsed.titleCn || '',
      summaryCn: parsed.summaryCn || '',
      reason: parsed.reason || '',
      scores: parsed.scores || {},
    };
  } catch (e) {
    // Try to extract JSON from markdown code fence
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return { titleCn: '', summaryCn: content.slice(0, 200), reason: '', scores: {} };
  }
}

// ===== 核心：分析单个事件 =====
async function analyzeOne(event) {
  const result = { cost: 0 };

  // Step 1: 翻译 + 摘要 + 评分
  const prompt = buildPrompt(event);
  const inTokens = estimateTokens(prompt);
  const aiRes = await chatCompletion([
    { role: 'system', content: '你是医药监管情报分析专家。只输出JSON。' },
    { role: 'user', content: prompt },
  ], { maxTokens: AI.maxTokens, temperature: AI.temperature });

  const parsed = parseAnalysisAI(aiRes.content);
  const outTokens = estimateTokens(aiRes.content);
  result.cost += 0; // Priced below

  // Apply results
  event.titleCn = parsed.titleCn || event.titleCn || event.titleOriginal;
  event.summaryCn = parsed.summaryCn || '';
  event.aiReason = parsed.reason || '';
  event.scores = JSON.stringify(parsed.scores || {});
  event.aiModel = aiRes.model || AI.model;

  // Calculate final score
  if (parsed.scores) {
    const s = parsed.scores;
    const fs = (s.sourceAuthority || 0) * 0.30 + (s.impactScope || 0) * 0.25 +
               (s.complianceUrgency || 0) * 0.20 + (s.industryAttention || 0) * 0.15 +
               (s.timeliness || 0) * 0.10;
    event.finalScore = Math.round(fs);
    event.importance = fs >= 85 ? 5 : fs >= 70 ? 4 : fs >= 55 ? 3 : fs >= 40 ? 2 : 1;
    event.scores = JSON.stringify(parsed.scores);
  }

  // Step 2: 非中文事件 → 翻译正文
  if (event.titleLang !== 'zh' && event.contentOriginal) {
    try {
      const tp = buildTranslatePrompt(event);
      const tRes = await chatCompletion([
        { role: 'user', content: tp },
      ], { model: AI.translateModel, maxTokens: 2048, temperature: 0.1 });
      event.contentCn = tRes.content || event.contentOriginal;
      event.aiTranslateModel = tRes.model || AI.translateModel;
    } catch {
      event.contentCn = event.contentOriginal; // 降级保留原文
    }
  } else if (event.titleLang === 'zh' && event.contentOriginal) {
    // 中文事件：contentCn = contentOriginal
    event.contentCn = event.contentOriginal;
  }

  return result;
}

// ===== 主流程 =====
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || args[args.indexOf('--limit') + 1] || '0');
  const dryRun = args.includes('--dry-run');

  console.log('============================================================');
  console.log('  AI 分析 v3.0 — 数据库模式');
  console.log('============================================================\n');

  const prisma = getPrisma();

  // 读取 pending 事件
  let pending = await prisma.event.findMany({
    where: { aiStatus: 'pending' },
    orderBy: { publishedAt: 'desc' },
  });

  const total = await prisma.event.count();
  const analyzed = await prisma.event.count({ where: { aiStatus: 'analyzed' } });

  console.log(`总事件: ${total}, 已分析: ${analyzed}, 待处理: ${pending.length}`);
  if (limit > 0) { pending = pending.slice(0, limit); console.log(`限制: ${limit} 条`); }

  if (pending.length === 0) {
    console.log('\n✅ 所有事件已完成分析！');
    await disconnectPrisma();
    return;
  }

  if (dryRun) {
    console.log('\n[DRY RUN] 预览:');
    pending.slice(0, 10).forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.sourceName}] ${e.titleLang} | ${(e.titleOriginal || '').slice(0, 50)}`);
    });
    console.log('\n✅ 预览完成。去掉 --dry-run 正式运行。');
    await disconnectPrisma();
    return;
  }

  // 并发分析
  const startTime = Date.now();
  let done = 0, errors = 0;

  for (let batch = 0; batch < pending.length; batch += AI.concurrency) {
    const batchItems = pending.slice(batch, batch + AI.concurrency);
    const tasks = batchItems.map(async (event, i) => {
      const seq = batch + i + 1;
      try {
        await analyzeOne(event);

        // 写回数据库
        await prisma.event.update({
          where: { id: event.id },
          data: {
            titleCn: event.titleCn,
            summaryCn: event.summaryCn,
            contentCn: event.contentCn,
            scores: event.scores,
            finalScore: event.finalScore,
            importance: event.importance,
            aiReason: event.aiReason,
            aiModel: event.aiModel,
            aiTranslateModel: event.aiTranslateModel || '',
            aiAnalyzedAt: new Date().toISOString(),
            aiStatus: 'analyzed',
            updatedAt: new Date().toISOString(),
          },
        });

        process.stdout.write(`  [${seq}/${pending.length}] OK ${event.sourceName} | ${(event.titleCn || '').slice(0, 40)}\n`);
        return { ok: true, seq };
      } catch (err) {
        process.stdout.write(`  [${seq}/${pending.length}] ERR ${err.message.slice(0, 60)}\n`);
        return { ok: false, seq };
      }
    });

    const results = await Promise.all(tasks);
    for (const r of results) { if (r.ok) done++; else errors++; }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n============================================================`);
  console.log(`  完成: ${done} 条, 失败: ${errors} 条, 耗时: ${elapsed}s`);
  console.log(`============================================================\n`);

  await disconnectPrisma();
}

main().catch(e => {
  console.error('Fatal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
