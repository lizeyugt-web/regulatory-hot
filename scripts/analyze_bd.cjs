/**
 * BD交易情报 · 专项AI分析脚本
 *
 * 针对 bd-task 标签文章，一次性完成：
 *   ① 中文摘要（150-250字）
 *   ② 推荐理由（1-2句）
 *   ③ 五维评分
 *   ④ 结构化BD交易信息（买卖方、金额、标的、模式等）
 *
 * 用法：node scripts/analyze_bd.cjs --limit 20  |  --all
 */
const { getPrisma, disconnectPrisma } = require('../src/db');

// ===== 统一 AI 配置：config/ai-models.json → WorkBuddy 积分反代 =====
// （原 Agnes 免费层 API 已下线替换，2026-07-29）
const { getModuleConfig } = require('./ai_config.cjs');
const BD_CFG = getModuleConfig('bd_analyze');
const API_KEY = BD_CFG.apiKey;
const BASE_URL = BD_CFG.baseUrl.replace(/\/$/, '');
const MODEL = BD_CFG.model;
const CONCURRENCY = 5;
const MAX_CHARS = 8000;

function log(level, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}]`, ...args);
}

// ===== AI 调用 =====
async function callAI(systemPrompt, userContent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BD_CFG.timeoutMs || 60000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);
    const json = await res.json();
    const msg = json.choices?.[0]?.message || {};
    return msg.content || msg.reasoning_content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ===== Prompt =====
const SYSTEM_PROMPT = `你是医药BD交易情报分析专家。根据提供的文章内容，输出结构化JSON。

输出格式（严格JSON，不要任何其他文字）：
{
  "summary": "中文摘要150-250字，概括核心内容",
  "reason": "推荐理由，1-2句话说明为什么这条信息重要",
  "scores": {
    "sourceAuthority": 50-90,
    "impactScope": 50-90,
    "timeliness": 50-90,
    "complianceUrgency": 30-70,
    "industryAttention": 50-90
  },
  "deal": null 或 {
    "type": "license-out|license-in|newco|coco|ma|funding|acquisition|other",
    "buyer": "买方/引进方公司名",
    "seller": "卖方/授权方公司名",
    "asset": "交易标的（产品名/管线/技术平台）",
    "upfrontAmount": "首付款金额+币种（如12.5亿美元）",
    "totalAmount": "总交易金额+币种（如152亿美元）",
    "milestoneAmount": "里程碑金额（如有）",
    "mode": "交易模式描述（License-out/NewCo/Co-Co/M&A/联合开发等）",
    "stage": "管线阶段（临床前/I期/II期/III期/已上市）",
    "therapeuticArea": "治疗领域（肿瘤/自免/代谢/神经/CNS等）",
    "modality": "药物类型（ADC/双抗/单抗/小分子/多肽/siRNA/细胞治疗/AI制药等）",
    "announceDate": "交易公告日期"
  }
}

评分标准：
- sourceAuthority: 来源权威度（官方公告90，行业媒体70，自媒体50）
- impactScope: 全球影响85+，亚太70+，国内50+
- timeliness: 当天90，本周80，本月70
- complianceUrgency: 有监管合规影响70+，纯商业30-50
- industryAttention: 头部药企/大额交易80+，小型biotech 50+

deal字段规则：
- 如果文章报道了具体的BD交易（有明确的买方、卖方、金额等），填写deal对象
- 如果文章只是行业评论/趋势分析/政策解读，没有具体交易，设deal为null
- 所有金额保留币种单位（美元/人民币/欧元等）
- 如果有多个交易，只提取最主要的一个`;

// ===== 处理单篇 =====
async function analyzeArticle(event, prisma) {
  // 构建输入：标题 + 摘要 + 正文（截断）
  const parts = [];
  if (event.titleCn) parts.push(`标题：${event.titleCn}`);
  if (event.summaryCn) parts.push(`摘要：${event.summaryCn}`);
  if (event.contentCn) {
    const body = event.contentCn.length > MAX_CHARS
      ? event.contentCn.slice(0, MAX_CHARS) + '...(截断)'
      : event.contentCn;
    parts.push(`正文：${body}`);
  }
  const input = parts.join('\n\n');

  try {
    const result = await callAI(SYSTEM_PROMPT, input);
    // 提取 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);

    // 写入数据库（使用已知字段，bdDealInfo通过raw SQL）
    const updateData = {
      summaryCn: parsed.summary || '',
      aiReason: parsed.reason || '',
      scores: JSON.stringify(parsed.scores || {}),
      finalScore: Math.round(
        Object.values(parsed.scores || {}).reduce((a, b) => a + b, 0) / 5
      ),
      aiStatus: 'analyzed',
      aiModel: MODEL,
      aiAnalyzedAt: new Date().toISOString(),
    };

    await prisma.event.update({
      where: { id: event.id },
      data: updateData,
    });

    // 写入结构化BD信息
    if (parsed.deal) {
      await prisma.$executeRawUnsafe(
        `UPDATE events SET bdDealInfo = ? WHERE id = ?`,
        JSON.stringify(parsed.deal),
        event.id
      );
    }

    return { success: true, isDeal: !!parsed.deal };
  } catch (e) {
    return { success: false, error: (e.message || String(e)).slice(0, 100) };
  }
}

// ===== 主流程 =====
async function main() {
  const prisma = getPrisma();

  // 读取参数
  const argLimit = process.argv.find(a => a.startsWith('--limit='));
  const limit = argLimit ? parseInt(argLimit.split('=')[1]) : 0;
  const isAll = process.argv.includes('--all');

  // 查待分析文章
  const where = {
    tags: { contains: 'bd-task' },
    aiStatus: 'pending',
    contentCn: { not: null },
  };

  const total = await prisma.event.count({ where });
  const take = limit > 0 ? limit : (isAll ? total : 20);

  log('INFO', `待分析BD文章: ${total} 篇, 本轮: ${take} 篇`);

  if (total === 0 || take === 0) {
    log('INFO', '没有待分析的文章');
    await disconnectPrisma();
    return;
  }

  const events = await prisma.event.findMany({
    where,
    select: { id: true, titleCn: true, summaryCn: true, contentCn: true },
    take,
    orderBy: { publishedAt: 'desc' },
  });

  let success = 0, deals = 0, failed = 0, progress = 0;

  // 并发处理
  const queue = [...events];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const ev = queue.shift();
      if (!ev) break;

      const result = await analyzeArticle(ev, prisma);
      progress++;
      if (result.success) {
        success++;
        if (result.isDeal) deals++;
      } else {
        failed++;
      }

      if (progress % 10 === 0 || progress === events.length) {
        log('INFO', `进度: ${progress}/${events.length} | 成功: ${success} | 交易: ${deals} | 失败: ${failed}`);
      }
      if (!result.success && progress <= 5) {
        log('WARN', `  失败样本: ${ev.titleCn?.slice(0, 30)} -> ${result.error}`);
      }
    }
  });

  await Promise.all(workers);

  log('INFO', `完成! 成功: ${success}, 交易事件: ${deals}, 失败: ${failed}`);
  log('INFO', `剩余待分析: ${total - success}`);

  await disconnectPrisma();
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
