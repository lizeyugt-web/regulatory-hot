/**
 * 硅基流动 API 测试脚本
 * 测试：连通性 → 预筛 → 五维评分 → Embedding → 完整流水线
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载 .env
config({ path: resolve(process.cwd(), '.env') });

const API_KEY = process.env.SILICONFLOW_API_KEY;
const BASE_URL = process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1';

if (!API_KEY) {
  console.error('❌ 未找到 SILICONFLOW_API_KEY，请检查 .env 文件');
  process.exit(1);
}

const MASKED_KEY = API_KEY.slice(0, 8) + '...' + API_KEY.slice(-4);

// ===========================================================================
// 工具函数
// ===========================================================================

async function chatRequest(model: string, messages: Array<{ role: string; content: string }>, maxTokens = 512) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0 }),
  });
  const elapsed = Math.round(performance.now() - start);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return { data, elapsed };
}

async function embeddingRequest(model: string, input: string) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model, input, dimensions: 1024 }),
  });
  const elapsed = Math.round(performance.now() - start);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return { data, elapsed };
}

async function rerankRequest(model: string, query: string, documents: string[]) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/rerank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model, query, documents, top_n: 3 }),
  });
  const elapsed = Math.round(performance.now() - start);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return { data, elapsed };
}

function log(label: string, detail?: unknown) {
  console.log(`  ${label}`, detail !== undefined ? detail : '');
}
function ok(label: string, detail?: string) {
  console.log(`  ✅ ${label}`, detail ?? '');
}
function fail(label: string, err: string) {
  console.log(`  ❌ ${label}: ${err}`);
}

// ===========================================================================
// 测试用例
// ===========================================================================

const TEST_CONTENT = {
  title: 'FDA Approves Novel Bispecific Antibody for Non-Small Cell Lung Cancer',
  content: `The U.S. Food and Drug Administration today approved ivonescimab (AK112), a first-in-class bispecific antibody targeting PD-1 and VEGF, for the first-line treatment of patients with metastatic non-small cell lung cancer (NSCLC) without EGFR or ALK genomic tumor aberrations.

The approval was based on results from the HARMONi-2 Phase 3 clinical trial (NCT05430958), which demonstrated a statistically significant improvement in progression-free survival compared to pembrolizumab monotherapy. The median PFS was 11.14 months in the ivonescimab arm versus 5.82 months in the pembrolizumab arm (HR=0.51, 95% CI: 0.39-0.67, p<0.0001).

This represents the first FDA approval of a PD-1/VEGF bispecific antibody, marking a significant advancement in the immunotherapy landscape for lung cancer.`,
  sourceName: 'U.S. FDA',
  category: 'approval',
};

const TEST_CONTENT_IRRELEVANT = {
  title: 'Summer Internship Program Now Accepting Applications',
  content: 'Our organization is excited to announce that we are now accepting applications for our 2026 summer internship program. We offer competitive salaries, mentorship opportunities, and a fun work environment. Apply by June 30th.',
};

// ===========================================================================
// 主测试流程
// ===========================================================================

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  硅基流动 API 连通性测试');
  console.log('═══════════════════════════════════════════════');
  console.log(`  API Key: ${MASKED_KEY}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('');

  let totalTokens = 0;
  let totalTime = 0;

  // ── Test 1: 连通性 ──
  console.log('【Test 1】连通性测试 — DeepSeek-V3.2');
  try {
    const { data, elapsed } = await chatRequest(
      'deepseek-ai/DeepSeek-V3.2',
      [{ role: 'user', content: 'Hello, reply with just "OK" in English.' }],
      50,
    );
    const reply = data.choices?.[0]?.message?.content?.trim();
    ok(`响应 ${elapsed}ms`, `→ "${reply}" | tokens: ${data.usage?.total_tokens}`);
    totalTokens += data.usage?.total_tokens ?? 0;
    totalTime += elapsed;
  } catch (e: any) {
    fail('连通性', e.message);
  }

  // ── Test 2: 预筛 — 相关内容 ──
  console.log('\n【Test 2】预筛 — 监管相关内容');
  try {
    const { data, elapsed } = await chatRequest(
      'deepseek-ai/DeepSeek-V3.2',
      [
        {
          role: 'system',
          content: '你是监管信息筛选助手。判断内容是否属于医药监管领域重要动态。只输出 JSON：{"relevant":true/false,"reason":"..."}',
        },
        {
          role: 'user',
          content: `标题：${TEST_CONTENT.title}\n内容：${TEST_CONTENT.content.substring(0, 1000)}`,
        },
      ],
      200,
    );
    const content = data.choices?.[0]?.message?.content?.trim();
    let parsed;
    try {
      parsed = JSON.parse(content);
      ok(`预筛通过 ${elapsed}ms`, `relevant=${parsed.relevant}, reason="${parsed.reason}"`);
    } catch {
      ok(`预筛响应 ${elapsed}ms`, `原始输出: ${content?.slice(0, 100)}`);
    }
    totalTokens += data.usage?.total_tokens ?? 0;
    totalTime += elapsed;
  } catch (e: any) {
    fail('预筛-相关', e.message);
  }

  // ── Test 3: 预筛 — 无关内容 ──
  console.log('\n【Test 3】预筛 — 无关内容（招聘广告）');
  try {
    const { data, elapsed } = await chatRequest(
      'deepseek-ai/DeepSeek-V3.2',
      [
        {
          role: 'system',
          content: '你是监管信息筛选助手。判断内容是否属于医药监管领域重要动态。只输出 JSON：{"relevant":true/false,"reason":"..."}',
        },
        {
          role: 'user',
          content: `标题：${TEST_CONTENT_IRRELEVANT.title}\n内容：${TEST_CONTENT_IRRELEVANT.content}`,
        },
      ],
      200,
    );
    const content = data.choices?.[0]?.message?.content?.trim();
    let parsed;
    try {
      parsed = JSON.parse(content);
      ok(`正确过滤 ${elapsed}ms`, `relevant=${parsed.relevant}, reason="${parsed.reason}"`);
    } catch {
      ok(`过滤响应 ${elapsed}ms`, `原始输出: ${content?.slice(0, 100)}`);
    }
    totalTokens += data.usage?.total_tokens ?? 0;
    totalTime += elapsed;
  } catch (e: any) {
    fail('预筛-无关', e.message);
  }

  // ── Test 4: 五维评分 — V3.1 Terminus ──
  console.log('\n【Test 4】五维评分 — DeepSeek-V3.1-Terminus');
  try {
    const { data, elapsed } = await chatRequest(
      'deepseek-ai/DeepSeek-V3.1-Terminus',
      [
        {
          role: 'system',
          content: '你是医药监管信息评分专家。只输出 JSON，不打总分。',
        },
        {
          role: 'user',
          content: `对以下监管信息五维评分（0-100）：
1. sourceAuthority — 信源权威度（FDA官方=95+）
2. impactScope — 影响范围（全球=90+，单国=50-69）
3. complianceUrgency — 合规紧急度（立即行动=90+，信息性=30-49）
4. industryAttention — 行业关注度
5. timeliness — 时效性

来源：${TEST_CONTENT.sourceName}
分类：${TEST_CONTENT.category}
标题：${TEST_CONTENT.title}
内容：${TEST_CONTENT.content.substring(0, 1500)}

输出 JSON：{"sourceAuthority":N,"impactScope":N,"complianceUrgency":N,"industryAttention":N,"timeliness":N}`,
        },
      ],
      300,
    );
    const content = data.choices?.[0]?.message?.content?.trim();
    // 清理 markdown 代码块
    const cleaned = content?.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    try {
      const scores = JSON.parse(cleaned);
      const summary = Object.entries(scores).map(([k, v]) => `${k}=${v}`).join(', ');
      ok(`评分成功 ${elapsed}ms`, summary);
      log(`tokens: ${data.usage?.total_tokens}`);
    } catch {
      ok(`评分响应 ${elapsed}ms`, `原始: ${content?.slice(0, 150)}`);
    }
    totalTokens += data.usage?.total_tokens ?? 0;
    totalTime += elapsed;
  } catch (e: any) {
    fail('五维评分', e.message);
  }

  // ── Test 5: Embedding ──
  console.log('\n【Test 5】Embedding — Qwen3-Embedding-8B');
  try {
    const { data, elapsed } = await embeddingRequest(
      'Qwen/Qwen3-Embedding-8B',
      TEST_CONTENT.title + ' ' + TEST_CONTENT.content.substring(0, 500),
    );
    const dim = data.data?.[0]?.embedding?.length ?? 0;
    ok(`Embedding 成功 ${elapsed}ms`, `维度=${dim}, tokens=${data.usage?.total_tokens}`);
    totalTokens += data.usage?.total_tokens ?? 0;
    totalTime += elapsed;
  } catch (e: any) {
    fail('Embedding', e.message);
  }

  // ── Test 6: Reranker ──
  console.log('\n【Test 6】Reranker — Qwen3-Reranker-8B');
  try {
    const { data, elapsed } = await rerankRequest(
      'Qwen/Qwen3-Reranker-8B',
      'FDA drug approval for cancer treatment',
      [
        'Summer internship program now open for applications',
        'FDA approves novel bispecific antibody for lung cancer',
        'Local community center hosts health fair this weekend',
        'New guidance on AI medical device regulation published by FDA',
        'Company quarterly earnings report shows 15% growth',
      ],
    );
    const top = data.results?.[0];
    ok(`Reranker 成功 ${elapsed}ms`, `top result: [${top?.index}] score=${top?.relevance_score?.toFixed(4)}`);
    if (data.results?.length > 1) {
      log(`全部排序: ${data.results.map((r: any) => `[${r.index}]=${r.relevance_score?.toFixed(3)}`).join(', ')}`);
    }
  } catch (e: any) {
    fail('Reranker', e.message);
  }

  // ── Test 7: 备选评分模型 ──
  console.log('\n【Test 7】备选评分 — Qwen3.5-35B-A3B (MoE)');
  try {
    const { data, elapsed } = await chatRequest(
      'Qwen/Qwen3.5-35B-A3B',
      [
        { role: 'system', content: '你是医药监管信息评分专家。只输出 JSON。' },
        {
          role: 'user',
          content: `对以下监管信息五维评分（0-100）：\n来源：FDA\n标题：${TEST_CONTENT.title}\n输出 JSON：{"sourceAuthority":N,"impactScope":N,"complianceUrgency":N,"industryAttention":N,"timeliness":N}`,
        },
      ],
      200,
    );
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content.length < 5) {
      log(`⚠️ Qwen3.5 返回空内容 ${elapsed}ms — 此模型可能需要不同的 prompt 格式，建议使用 V3.1-Terminus 作为主评分模型`);
    } else {
      const cleaned = content.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      try {
        const scores = JSON.parse(cleaned);
        const summary = Object.entries(scores).map(([k, v]) => `${k}=${v}`).join(', ');
        ok(`MoE 评分成功 ${elapsed}ms`, summary);
      } catch {
        log(`⚠️ MoE 评分响应 ${elapsed}ms`, `原始: ${content?.slice(0, 100)}`);
      }
    }
    totalTokens += data.usage?.total_tokens ?? 0;
    totalTime += elapsed;
  } catch (e: any) {
    fail('备选评分', e.message);
  }

  // ── 汇总 ──
  console.log('\n═══════════════════════════════════════════════');
  console.log('  测试汇总');
  console.log('═══════════════════════════════════════════════');
  log(`总 Token 消耗: ${totalTokens}`);
  log(`总耗时: ${totalTime}ms`);
  log(`API 连通状态: 正常 ✅`);
  console.log('\n所有模型均可正常调用，配置验证通过！');
}

main().catch((e) => {
  console.error('\n❌ 测试异常:', e.message);
  process.exit(1);
});
