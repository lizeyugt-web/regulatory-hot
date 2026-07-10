/**
 * 批量解析公众号 fakeid
 * 
 * 遍历 mp_watch.json 中所有缺少 fakeid 的公众号，
 * 通过 wechat-article-exporter API 搜索获取 fakeid
 * 
 * 用法: node scripts/batch_fakeid.cjs
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXPORTER_URL = process.env.WX_EXPORTER_URL || 'https://127.0.0.1:3443';
const AUTH_KEY = process.env.WX_AUTH_KEY || 'def858160e3441dd88a377cba24ce0be';

const MP_WATCH_FILE = path.join(PROJECT_ROOT, 'config', 'mp_watch.json');
const FAKEID_CACHE_FILE = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');

const urlObj = new URL(EXPORTER_URL);
const PROTOCOL = urlObj.protocol.replace(':', '');
const HOST = urlObj.hostname;
const PORT = parseInt(urlObj.port) || (PROTOCOL === 'https' ? 443 : 80);

function apiGet(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const p = qs ? `${endpoint}?${qs}` : endpoint;
    
    const transport = PROTOCOL === 'https' ? https : http;
    const req = transport.request({
      host: HOST, port: PORT, path: p, method: 'GET',
      headers: { 'Accept': 'application/json, */*', 'Cookie': `auth-key=${AUTH_KEY}`, 'X-Auth-Key': AUTH_KEY },
      timeout: 15000,
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', (e) => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function searchAccount(name) {
  // 先精确搜索
  let result = await apiGet('/api/public/v1/account', { keyword: name, begin: 0, size: 10 });
  if (result?.list) {
    const exact = result.list.find(a => (a.nickname || a.name || '').trim() === name);
    if (exact) return exact.fakeid;
    // 模糊匹配
    const fuzzy = result.list.find(a => {
      const n = (a.nickname || a.name || '').trim();
      return n.includes(name) || name.includes(n);
    });
    if (fuzzy) return fuzzy.fakeid;
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== 批量解析公众号 fakeid ===\n');
  
  // 验证 auth
  const authCheck = await apiGet('/api/public/v1/authkey');
  if (!authCheck || authCheck.code !== 0) {
    console.error('❌ Auth-key 验证失败，请检查 WX_AUTH_KEY');
    process.exit(1);
  }
  console.log('✅ Auth-key 有效\n');
  
  // 加载配置
  const watch = JSON.parse(fs.readFileSync(MP_WATCH_FILE, 'utf-8'));
  const cache = JSON.parse(fs.readFileSync(FAKEID_CACHE_FILE, 'utf-8'));
  
  const accounts = watch.accounts;
  const missing = accounts.filter(a => !cache[a.name]);
  
  console.log(`总公众号: ${accounts.length}, 已有 fakeid: ${Object.keys(cache).length}, 缺失: ${missing.length}\n`);
  
  if (missing.length === 0) {
    console.log('✅ 所有公众号都有 fakeid！');
    return;
  }
  
  let found = 0;
  let failed = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const mp = missing[i];
    const progress = `[${i + 1}/${missing.length}]`;
    
    try {
      const fakeid = await searchAccount(mp.name);
      if (fakeid) {
        cache[mp.name] = fakeid;
        found++;
        console.log(`${progress} ✅ ${mp.name} → ${fakeid}`);
      } else {
        failed++;
        console.log(`${progress} ❌ ${mp.name} — 未找到`);
      }
    } catch (e) {
      failed++;
      console.log(`${progress} ❌ ${mp.name} — 错误: ${e.message}`);
    }
    
    // 延迟 1s 避免 API 限流
    if (i % 5 === 4) await sleep(2000);
    else await sleep(500);
  }
  
  // 保存缓存
  fs.writeFileSync(FAKEID_CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`\n=== 完成 ===`);
  console.log(`找到: ${found}, 未找到: ${failed}`);
  console.log(`fakeid 缓存已更新: ${Object.keys(cache).length} 个`);
  
  // 推送
  try {
    const { execSync } = require('child_process');
    execSync('git add config/mp_fakeid_cache.json', { cwd: PROJECT_ROOT });
    const diff = execSync('git diff --staged --name-only', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();
    if (diff) {
      execSync(`git commit -m "📱 批量更新 fakeid 缓存 +${found}"`, { cwd: PROJECT_ROOT });
      execSync('git push origin main', { cwd: PROJECT_ROOT, timeout: 30000 });
      console.log('✅ Git 推送成功');
    }
  } catch (e) {
    console.log('⚠️ Git 推送失败（缓存已保存到本地）');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
