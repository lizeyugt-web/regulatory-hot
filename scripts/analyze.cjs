/**
 * 监管信息 AI 分析脚本 v2.0 — 一步完成（对齐 AIHOT 策略）
 * 
 * 每次 API 调用同时完成：
 *   ① 中文标题翻译
 *   ② AI 中文摘要（150-250字）
 *   ③ AI 推荐理由（1-2句）
 *   ④ 五维评分
 * 
 * 用法:
 *   node scripts/analyze.cjs                        # 分析所有未分析的条目
 *   node scripts/analyze.cjs --limit 20             # 只分析 N 条
 *   node scripts/analyze.cjs --dry-run              # 预览模式（不调用 API）
 *   node scripts/analyze.cjs --force                # 强制重新分析所有
 */

const fs = require('fs');
const path = require('path');

// ===========================================================================
// 配置
// ===========================================================================
const EVENTS_FILE = path.join(__dirname, '..', 'regulatory-hot', 'public', 'data', 'events.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'regulatory-hot', 'public', 'data', '.progress.json');
const ENV_FILE = path.join(__dirname, '..', 'regulatory-hot', '.env');

function loadEnv() {
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (e) { /* noop */ }
}
loadEnv();

const AI_CONFIG = {
  baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY || '',
  // 一步完成模型：默认用 Qwen3.5-35B-A3B（~3x 快于 DeepSeek-V3.2）
  // 可通过 env SILICONFLOW_MODEL / AI_CONCURRENCY 覆盖
  model: process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.5-35B-A3B',
  maxTokens: 600,                        // 摘要+推荐+评分 ≈ 400 tokens
  temperature: 0.3,
  delayMs: 50,                           // 12 并发后降低单批间隔
  maxRetries: 2,                         // 失败快速跳过
  concurrency: parseInt(process.env.AI_CONCURRENCY || '12'),
};

const PRICING = { 'deepseek-ai/DeepSeek-V3.2': { input: 4.00, output: 6.00 } };

// ===========================================================================
// 工具函数
// ===========================================================================
function estimateTokens(text) {
  if (!text) return 0;
  const cnChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  return Math.ceil(cnChars / 1.5 + (text.length - cnChars) / 4);
}

function calcCost(model, inputTokens, outputTokens) {
  const p = PRICING[model] || { input: 1, output: 2 };
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function chatCompletion(messages, { maxTokens = 1024, temperature = 0.3 } = {}) {
  if (!AI_CONFIG.apiKey) throw new Error('SILICONFLOW_API_KEY 未配置');

  let lastError = null;
  for (let attempt = 0; attempt < AI_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        if (response.status === 429) {
          const waitMs = Math.min((attempt + 1) * 2000, 10000);
          console.log(`  [RETRY] 速率限制，等待 ${waitMs / 1000}s...`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};
      return {
        content,
        usage: {
          promptTokens: usage.prompt_tokens || estimateTokens(messages.map(m => m.content).join('\n')),
          completionTokens: usage.completion_tokens || estimateTokens(content),
        },
        model: data.model || AI_CONFIG.model,
      };
    } catch (err) {
      lastError = err;
      if (attempt < AI_CONFIG.maxRetries - 1) {
        console.log(`  [RETRY] ${err.message}`);
        await sleep((attempt + 1) * 1000);
      }
    }
  }
  throw lastError;
}

// ===========================================================================
// AI Prompt — 一步完成：标题翻译 + 摘要 + 推荐理由 + 五维评分
// ===========================================================================
function buildPrompt(event) {
  return `你是全球医药监管情报分析专家。请分析以下 FDA/EMA 等监管机构的官方信息：

【原始信息】
标题（英文）：${event.titleEn || event.title || ''}
原始摘要：${event.summary || '(无)'}
来源：${event.sourceName || ''}
分类：${event.category || ''}

请返回 JSON（直接输出，不要 markdown 代码块）：
{
  "titleCn": "准确、专业的中文标题翻译",
  "aiSummaryCn": "中文摘要（150-250字），包含：事件核心事实（谁/什么/何时）、影响范围（哪些产品/领域受影响）、合规要点（需要关注的关键合规事项）",
  "aiReason": "推荐理由（1-2句话），说明为什么中国药企/监管从业者需要关注这条信息",
  "scores": {
    "sourceAuthority": 0-100（信源权威度：FDA/EMA官方公告=90+，WHO/ICH=80+，行业媒体=50-70）,
    "impactScope": 0-100（影响范围：全球性=90+，跨国=70-89，单国=50-69，局部=30-49）,
    "complianceUrgency": 0-100（合规紧急度：需立即行动=90+，3个月内=70-89，6个月内=50-69，信息性=30-49）,
    "industryAttention": 0-100（行业关注度：广泛关注=90+，领域关注=70-89，小众=40-69）,
    "timeliness": 0-100（时效性：今日新闻=90+，本周=70-89，本月=50-69，更早=30-49）
  }
}`;
}

// ===========================================================================
// 保存进度状态
// ===========================================================================
function saveProgress(stats) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      ...stats,
      updatedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
  } catch { /* noop */ }
}

// ===========================================================================
// 核心：一步分析单条事件
// ===========================================================================
async function analyzeOneStep(event, totalCost) {
  const prompt = buildPrompt(event);
  const inputTokens = estimateTokens(prompt);

  const result = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { maxTokens: AI_CONFIG.maxTokens, temperature: AI_CONFIG.temperature }
  );

  // 解析 JSON
  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch { parsed = {}; }
    } else { parsed = {}; }
  }

  const outputTokens = result.usage.completionTokens;
  const cost = calcCost(AI_CONFIG.model, inputTokens, outputTokens);
  totalCost.total += cost;

  // 写入 AI 字段
  if (parsed.titleCn) event.title = parsed.titleCn;
  event.aiSummaryCn = parsed.aiSummaryCn || '';
  event.aiReason = parsed.aiReason || '';
  event.aiSummaryModel = AI_CONFIG.model;
  event.aiAnalyzedAt = new Date().toISOString();

  // 五维评分
  if (parsed.scores && typeof parsed.scores === 'object') {
    const s = parsed.scores;
    event.scores = {
      sourceAuthority: clamp(s.sourceAuthority, 0, 100),
      impactScope: clamp(s.impactScope, 0, 100),
      timeliness: clamp(s.timeliness, 0, 100),
      complianceUrgency: clamp(s.complianceUrgency, 0, 100),
      industryAttention: clamp(s.industryAttention, 0, 100),
    };
    // 重新计算 finalScore
    event.finalScore = computeScore(event.scores, event.sourceLevel);
  }

  // 成本
  if (!event.aiCost) event.aiCost = 0;
  event.aiCost += cost;

  return { inputTokens, outputTokens, cost };
}

function clamp(v, min, max) {
  const n = Math.round(Number(v));
  if (isNaN(n)) return 50;
  return Math.max(min, Math.min(max, n));
}

function computeScore(scores, sourceLevel) {
  const weights = { sourceAuthority: 0.30, impactScope: 0.25, complianceUrgency: 0.20, industryAttention: 0.15, timeliness: 0.10 };
  const baseScore = { 'T1': 85, 'T1.5': 65, 'T2': 45, 'T3': 25 };
  const weighted =
    scores.sourceAuthority * weights.sourceAuthority +
    scores.impactScope * weights.impactScope +
    scores.complianceUrgency * weights.complianceUrgency +
    scores.industryAttention * weights.industryAttention +
    scores.timeliness * weights.timeliness;
  const sourceBonus = ((baseScore[sourceLevel] || 50) - 50) * 0.1;
  return Math.min(100, Math.max(0, Math.round(weighted + sourceBonus)));
}

// ===========================================================================
// 主流程
// ===========================================================================
async function main() {
  const args = process.argv.slice(2);
  let limit = 0;
  const limitEqIdx = args.findIndex(a => a.startsWith('--limit='));
  if (limitEqIdx >= 0) {
    limit = parseInt(args[limitEqIdx].split('=')[1], 10) || 0;
  } else {
    const limitIdx = args.indexOf('--limit');
    if (limitIdx >= 0 && limitIdx + 1 < args.length) limit = parseInt(args[limitIdx + 1], 10) || 0;
  }
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log('============================================================');
  console.log('  监管信息 AI 分析 v2.0（一步完成）');
  console.log('============================================================');
  console.log(`  模型: ${AI_CONFIG.model}`);
  console.log(`  模式: ${dryRun ? '预览' : '正式运行'}${force ? ' (强制)' : ''}`);
  if (limit) console.log(`  限制: ${limit} 条`);
  console.log('============================================================\n');

  if (!fs.existsSync(EVENTS_FILE)) {
    console.error('[ERROR] events.json 不存在:', EVENTS_FILE);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  const items = data.items || [];

  // 筛选：无 aiSummaryCn 的条目（或 force 全量）
  let toAnalyze = force ? items : items.filter(e => !e.aiSummaryCn);
  if (limit > 0) toAnalyze = toAnalyze.slice(0, limit);

  const alreadyDone = items.filter(e => e.aiSummaryCn).length;
  console.log(`  总条目: ${items.length}`);
  console.log(`  已完成: ${alreadyDone}`);
  console.log(`  待处理: ${toAnalyze.length}`);
  console.log('');

  if (toAnalyze.length === 0) {
    console.log('✅ 所有条目已完成分析！');
    saveProgress({ total: items.length, completed: items.length, pending: 0 });
    return;
  }

  if (dryRun) {
    console.log('[DRY RUN] 以下条目将被处理：');
    for (let i = 0; i < Math.min(toAnalyze.length, 10); i++) {
      console.log(`  ${i + 1}. [${toAnalyze[i].sourceName}] ${(toAnalyze[i].titleEn || toAnalyze[i].title || '').slice(0, 50)}`);
    }
    if (toAnalyze.length > 10) console.log(`  ... 还有 ${toAnalyze.length - 10} 条`);
    console.log('\n✅ 预览完成。去掉 --dry-run 以正式运行。');
    return;
  }

  // 正式分析（并发池）
  const totalCost = { total: 0 };
  let doneCount = 0;
  let errorCount = 0;
  const startTime = Date.now();
  const concurrency = AI_CONFIG.concurrency;

  for (let batch = 0; batch < toAnalyze.length; batch += concurrency) {
    const batchItems = toAnalyze.slice(batch, Math.min(batch + concurrency, toAnalyze.length));
    const tasks = batchItems.map(async (event, bi) => {
      const idx = items.findIndex(e => e.id === event.id);
      const label = (event.titleEn || event.title || '').slice(0, 50);
      const seqNum = batch + bi + 1;
      try {
        const r = await analyzeOneStep(event, totalCost);
        items[idx] = event;
        return { seqNum, label, cost: r.cost, ok: true };
      } catch (err) {
        return { seqNum, label, error: err.message, ok: false };
      }
    });
    const results = await Promise.all(tasks);
    for (const r of results) {
      if (r.ok) {
        doneCount++;
        process.stdout.write(`  [${r.seqNum}/${toAnalyze.length}] OK ${r.label.slice(0, 40)} CNY${r.cost.toFixed(4)}\n`);
      } else {
        errorCount++;
        process.stdout.write(`  [${r.seqNum}/${toAnalyze.length}] ERR ${r.error.slice(0, 60)}\n`);
      }
    }
    // 每批写一次磁盘 + 更新进度
    data.items = items;
    data.updated = new Date().toISOString();
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
    saveProgress({
      total: items.length,
      completed: items.filter(e => e.aiSummaryCn).length,
      pending: items.length - items.filter(e => e.aiSummaryCn).length,
    });
    if (batch + concurrency < toAnalyze.length) {
      await sleep(AI_CONFIG.delayMs);
    }
  }

  // 最终写入
  data.items = items;
  data.updated = new Date().toISOString();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const completedTotal = items.filter(e => e.aiSummaryCn).length;

  console.log('\n============================================================');
  console.log('  分析完成');
  console.log('============================================================');
  console.log(`  处理: ${doneCount} 条 · 失败: ${errorCount}`);
  console.log(`  总进度: ${completedTotal}/${items.length}`);
  console.log(`  耗时: ${elapsed}s · 费用: ¥${totalCost.total.toFixed(4)}`);
  console.log('============================================================');

  saveProgress({
    total: items.length,
    completed: completedTotal,
    pending: items.length - completedTotal,
    lastRun: new Date().toISOString(),
    lastDuration: `${elapsed}s`,
    lastCost: totalCost.total.toFixed(4),
  });

  console.log('\n✅ 刷新 http://127.0.0.1:3457/all 查看最新结果');
}

main().catch(err => {
  console.error('\n❌ 致命错误:', err.message);
  process.exit(1);
});
