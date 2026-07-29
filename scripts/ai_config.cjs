/**
 * 统一 AI 配置加载器 (CJS) — 全站 AI 调用的唯一入口配置
 *
 * 读取 config/ai-models.json，提供：
 *   - getProvider()        反代端点配置（baseUrl/apiKey/timeout/retries）
 *   - getModuleConfig(name) 指定模块的完整调用配置（含 model）
 *   - getSiliconflow()     硅基流动配置（embedding/reranker 专用）
 *   - listModules()        所有模块名
 *
 * 环境变量优先于配置文件：
 *   WB_PROXY_BASE_URL        覆盖 provider.baseUrl
 *   WB_PROXY_API_KEY         覆盖 provider.apiKey
 *   AI_MODEL_<MODULE大写>    覆盖某模块模型，如 AI_MODEL_ANALYZE=deepseek-v4-pro
 */

const fs = require('fs');
const path = require('path');

let _cache = null;

function findConfigPath() {
  const candidates = [
    path.join(__dirname, '..', 'config', 'ai-models.json'),          // scripts/ 下
    path.join(__dirname, 'config', 'ai-models.json'),                // 项目根直接调用
    path.join(process.cwd(), 'config', 'ai-models.json'),            // cwd = 项目根
    path.join(process.cwd(), '..', 'config', 'ai-models.json'),      // cwd = regulatory-hot
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* noop */ }
  }
  throw new Error('ai-models.json 未找到，搜索路径: ' + candidates.join(', '));
}

/** 解析 "env:VAR_NAME" 引用 */
function resolveEnvRef(value) {
  if (typeof value === 'string' && value.startsWith('env:')) {
    return process.env[value.slice(4)] || '';
  }
  return value;
}

function loadConfig() {
  if (_cache) return _cache;
  const raw = JSON.parse(fs.readFileSync(findConfigPath(), 'utf8'));

  // provider 环境变量覆盖
  const provider = { ...raw.provider };
  if (process.env.WB_PROXY_BASE_URL) provider.baseUrl = process.env.WB_PROXY_BASE_URL;
  if (process.env.WB_PROXY_API_KEY) provider.apiKey = process.env.WB_PROXY_API_KEY;
  provider.apiKey = resolveEnvRef(provider.apiKey);

  const siliconflow = raw.siliconflow ? { ...raw.siliconflow } : null;
  if (siliconflow) siliconflow.apiKey = resolveEnvRef(siliconflow.apiKey);

  _cache = { ...raw, provider, siliconflow };
  return _cache;
}

/** 强制重新加载（修改配置后调用） */
function reloadConfig() { _cache = null; return loadConfig(); }

function getProvider() { return loadConfig().provider; }

function getSiliconflow() {
  const sf = loadConfig().siliconflow;
  if (!sf) throw new Error('ai-models.json 缺少 siliconflow 配置');
  return sf;
}

/**
 * 获取模块完整调用配置
 * @param {'analyze'|'translate'|'prefilter'|'scoring'|'bd_analyze'|'classify'|'report'|'embedding'|'reranker'} name
 * @returns {{ baseUrl:string, apiKey:string, model:string, timeoutMs:number, maxRetries:number, provider:string }}
 */
function getModuleConfig(name) {
  const cfg = loadConfig();
  const mod = cfg.modules?.[name];
  if (!mod) throw new Error(`ai-models.json 中未定义模块: ${name}`);

  // 模块级 provider 覆盖（如 embedding 走 siliconflow）
  const useSiliconflow = mod.provider === 'siliconflow';
  const base = useSiliconflow ? cfg.siliconflow : cfg.provider;
  if (!base) throw new Error(`模块 ${name} 指定的 provider 未配置: ${mod.provider}`);

  // 环境变量覆盖模型：AI_MODEL_ANALYZE / AI_MODEL_TRANSLATE / ...
  const envKey = 'AI_MODEL_' + name.toUpperCase();
  const model = process.env[envKey] || mod.model;

  return {
    provider: useSiliconflow ? 'siliconflow' : (cfg.provider.name || 'workbuddy-proxy'),
    baseUrl: base.baseUrl,
    apiKey: base.apiKey || '',
    model,
    timeoutMs: mod.timeoutMs || cfg.provider.timeoutMs || 60000,
    maxRetries: mod.maxRetries ?? cfg.provider.maxRetries ?? 2,
  };
}

function listModules() { return Object.keys(loadConfig().modules || {}); }

function listAvailableModels() { return loadConfig().availableModels || []; }

module.exports = {
  loadConfig, reloadConfig, getProvider, getSiliconflow,
  getModuleConfig, listModules, listAvailableModels, findConfigPath,
};
