/**
 * 统一 AI 配置加载器 (TS) — 与 scripts/ai_config.cjs 读同一份 config/ai-models.json
 *
 * 仅供服务端（API Routes / Server Components）使用。
 * 环境变量优先于配置文件：
 *   WB_PROXY_BASE_URL / WB_PROXY_API_KEY / AI_MODEL_<MODULE大写>
 */
import fs from 'fs';
import path from 'path';

export type AIModuleName =
  | 'analyze' | 'translate' | 'prefilter' | 'scoring'
  | 'bd_analyze' | 'classify' | 'report'
  | 'embedding' | 'reranker';

export interface AIModuleConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

interface RawConfig {
  provider: { name: string; baseUrl: string; apiKey: string; timeoutMs?: number; maxRetries?: number };
  siliconflow?: { baseUrl: string; apiKey: string };
  modules: Record<string, { model: string; provider?: string; timeoutMs?: number; maxRetries?: number }>;
  availableModels?: Array<{ id: string; label: string; tier: string; suggest: string }>;
}

let _cache: RawConfig | null = null;

function findConfigPath(): string {
  const candidates = [
    path.join(process.cwd(), 'config', 'ai-models.json'),        // cwd = 项目根
    path.join(process.cwd(), '..', 'config', 'ai-models.json'),  // cwd = regulatory-hot
    path.join(__dirname, '..', '..', 'config', 'ai-models.json'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* noop */ }
  }
  throw new Error('ai-models.json 未找到: ' + candidates.join(', '));
}

function resolveEnvRef(value: string): string {
  if (typeof value === 'string' && value.startsWith('env:')) {
    return process.env[value.slice(4)] || '';
  }
  return value;
}

export function loadAIConfig(): RawConfig {
  if (_cache) return _cache;
  const raw = JSON.parse(fs.readFileSync(findConfigPath(), 'utf8')) as RawConfig;
  const provider = { ...raw.provider };
  if (process.env.WB_PROXY_BASE_URL) provider.baseUrl = process.env.WB_PROXY_BASE_URL;
  if (process.env.WB_PROXY_API_KEY) provider.apiKey = process.env.WB_PROXY_API_KEY;
  provider.apiKey = resolveEnvRef(provider.apiKey);
  const siliconflow = raw.siliconflow
    ? { ...raw.siliconflow, apiKey: resolveEnvRef(raw.siliconflow.apiKey) }
    : undefined;
  _cache = { ...raw, provider, siliconflow };
  return _cache;
}

export function reloadAIConfig(): RawConfig {
  _cache = null;
  return loadAIConfig();
}

export function getAIModuleConfig(name: AIModuleName): AIModuleConfig {
  const cfg = loadAIConfig();
  const mod = cfg.modules?.[name];
  if (!mod) throw new Error(`ai-models.json 中未定义模块: ${name}`);

  const useSiliconflow = mod.provider === 'siliconflow';
  const base = useSiliconflow ? cfg.siliconflow : cfg.provider;
  if (!base) throw new Error(`模块 ${name} 指定的 provider 未配置`);

  const envKey = 'AI_MODEL_' + name.toUpperCase();
  return {
    provider: useSiliconflow ? 'siliconflow' : (cfg.provider.name || 'workbuddy-proxy'),
    baseUrl: base.baseUrl,
    apiKey: base.apiKey || '',
    model: process.env[envKey] || mod.model,
    timeoutMs: mod.timeoutMs || cfg.provider.timeoutMs || 60000,
    maxRetries: mod.maxRetries ?? cfg.provider.maxRetries ?? 2,
  };
}

export function listAvailableModels() {
  return loadAIConfig().availableModels || [];
}
