/**
 * 存量事件分类回刷脚本 v1.0
 *
 * 用便宜的 Qwen2.5-7B-Instruct 对已分析事件做轻量分类：
 *   - affectedCountries: 文章涉及的国家/地区
 *   - contentType: 内容类型 (regulation/approval/safety/enterprise/industry)
 *
 * 不重复翻译/摘要/评分，只更新分类相关字段。
 *
 * 用法:
 *   node scripts/classify_batch.cjs                 # 全量回刷
 *   node scripts/classify_batch.cjs --limit 50      # 只处理 N 条
 *   node scripts/classify_batch.cjs --dry-run       # 预览模式
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

// ===== Config（统一走 config/ai-models.json → WorkBuddy 积分反代，原 Agnes 已替换）=====
const { getModuleConfig } = require('./ai_config.cjs');
const _clsCfg = getModuleConfig('classify');
const AI = {
  baseUrl: _clsCfg.baseUrl,
  apiKey: _clsCfg.apiKey,
  model: _clsCfg.model,
  concurrency: parseInt(process.env.AI_CONCURRENCY || '8'),
  maxTokens: 200,
  temperature: 0.1,
  maxRetries: _clsCfg.maxRetries || 2,
};

// ===== Utilities =====
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function chatCompletion(messages, opts = {}) {
  const { maxTokens = 200, temperature = 0.1 } = opts;
  if (!AI.apiKey) throw new Error('反代 API Key 未配置（config/ai-models.json）');

  for (let attempt = 0; attempt < AI.maxRetries; attempt++) {
    try {
      const res = await fetch(`${AI.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI.apiKey}` },
        body: JSON.stringify({
          model: AI.model, messages,
          max_tokens: maxTokens, temperature,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) { await sleep((attempt + 1) * 2000); continue; }
        throw new Error(`API ${res.status}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      return { content, model: data.model || AI.model };
    } catch (err) {
      if (attempt < AI.maxRetries - 1) { await sleep((attempt + 1) * 1000); continue; }
      throw err;
    }
  }
}

// ===== Prompt: 仅分类 =====
function buildClassifyPrompt(event) {
  const title = event.titleCn || event.titleOriginal || '';
  const summary = (event.summaryCn || event.summaryOriginal || '').slice(0, 300);
  const source = event.sourceName || '';

  return `判断以下医药监管信息涉及的国家/地区和内容类型。

标题：${title}
来源：${source}
摘要：${summary}

输出 JSON：
{
  "affectedCountries": ["CN", "US"],
  "contentType": "regulation"
}

- affectedCountries: ISO 3166-1 alpha-2 国家代码数组（CN/US/EU/JP/GB等），按重要性排序
- contentType 取值：
   regulation = 法规/指南/标准/政策（监管机构规范性文件）
   approval = 产品批准/新药上市/新适应症
   safety = 安全警戒/不良反应/召回/警告信/违规
   enterprise = 企业动态/研发管线/财报/合作
   industry = 行业分析/会议/市场趋势/报告

只输出JSON，不要解释。`;
}

// ===== AI contentType → DB category =====
function mapContentType(ct) {
  const map = {
    regulation: 'regulation',
    approval: 'approval',
    safety: 'safety',
    enterprise: 'insight',
    industry: 'insight',
  };
  return map[ct] || 'insight';
}

function parseResult(content) {
  try {
    const clean = content.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

// ===== 核心: 分类单条事件 =====
async function classifyOne(event) {
  const prompt = buildClassifyPrompt(event);
  const aiRes = await chatCompletion([
    { role: 'system', content: '你是医药监管情报分类专家。只输出JSON。' },
    { role: 'user', content: prompt },
  ], { maxTokens: AI.maxTokens, temperature: AI.temperature });

  const parsed = parseResult(aiRes.content);
  if (!parsed) return;

  // Apply classification
  if (Array.isArray(parsed.affectedCountries) && parsed.affectedCountries.length > 0) {
    event.sourceCountry = parsed.affectedCountries[0];
    event.affectedRegions = JSON.stringify(parsed.affectedCountries);
  }
  if (parsed.contentType) {
    event.category = mapContentType(parsed.contentType);
  }
  // Auto-select if finalScore >= 55
  if (event.finalScore >= 55) {
    event.selected = 1;
  }
}

// ===== 主流程 =====
async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 0 : 0;
  const dryRun = args.includes('--dry-run');

  console.log('============================================================');
  console.log('  存量事件分类回刷 v1.0');
  console.log('============================================================');
  console.log(`  模型: ${AI.model}`);
  console.log(`  模式: ${dryRun ? '预览' : '正式运行'}`);
  if (limit) console.log(`  限制: ${limit} 条`);
  console.log('============================================================\n');

  const prisma = getPrisma();

  // 读取已分析的事件（全部回刷）
  let events = await prisma.event.findMany({
    where: { aiStatus: 'analyzed' },
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`已分析事件总数: ${events.length}`);
  if (limit > 0) { events = events.slice(0, limit); }

  if (events.length === 0) {
    console.log('\n✅ 无待处理事件！');
    await disconnectPrisma();
    return;
  }

  if (dryRun) {
    console.log('\n[DRY RUN] 预览前 10 条:');
    events.slice(0, 10).forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.sourceName}] ${(e.titleCn || e.titleOriginal || '').slice(0, 50)}`);
      console.log(`     当前: country=${e.sourceCountry}, category=${e.category}, score=${e.finalScore}`);
    });
    console.log('\n✅ 预览完成。去掉 --dry-run 正式运行。');
    await disconnectPrisma();
    return;
  }

  // 并发分类
  const startTime = Date.now();
  let done = 0, errors = 0, changed = 0;

  for (let batch = 0; batch < events.length; batch += AI.concurrency) {
    const batchItems = events.slice(batch, batch + AI.concurrency);
    const tasks = batchItems.map(async (event, i) => {
      const seq = batch + i + 1;
      const oldCountry = event.sourceCountry;
      const oldCategory = event.category;
      try {
        await classifyOne(event);

        // 写回数据库
        await prisma.event.update({
          where: { id: event.id },
          data: {
            sourceCountry: event.sourceCountry,
            affectedRegions: event.affectedRegions,
            category: event.category,
            selected: event.selected != null ? event.selected : undefined,
            updatedAt: new Date().toISOString(),
          },
        });

        const didChange = (oldCountry !== event.sourceCountry) || (oldCategory !== event.category);
        if (didChange) changed++;
        const flag = didChange ? ' ✨' : '';

        process.stdout.write(`  [${seq}/${events.length}]${flag} ${event.sourceName} | ${event.sourceCountry} | ${event.category}\n`);
        return { ok: true, seq };
      } catch (err) {
        process.stdout.write(`  [${seq}/${events.length}] ERR ${err.message.slice(0, 60)}\n`);
        return { ok: false, seq };
      }
    });

    const results = await Promise.all(tasks);
    for (const r of results) { if (r.ok) done++; else errors++; }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n============================================================`);
  console.log(`  完成: ${done} 条 | 错误: ${errors} 条 | 分类变更: ${changed} 条`);
  console.log(`  耗时: ${elapsed}s`);
  console.log(`============================================================\n`);

  await disconnectPrisma();
}

main().catch(e => {
  console.error('Fatal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
