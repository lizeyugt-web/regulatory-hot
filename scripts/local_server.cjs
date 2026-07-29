/**
 * 本地采集控制台 — 完全本地化
 *
 * 一键采集：微信 → merge → AI分析 → 前端展示
 * 不依赖 GitHub、不依赖 ECS
 *
 * 启动: node scripts/local_server.cjs
 * 访问: http://localhost:3458
 *
 * 环境变量（从 regulatory-hot/.env 自动加载）:
 *   WX_AUTH_KEY        - 微信认证密钥（私聊告知）
 *   SILICONFLOW_API_KEY - 硅基流动密钥（仅 embedding/reranker 聚类用；chat 调用已统一走 config/ai-models.json → WorkBuddy 积分反代）
 *   PORT                - 面板端口 (默认 3458)
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3458;

// ============ 加载 .env ============
function loadEnv() {
  const envFile = path.join(PROJECT_ROOT, 'regulatory-hot', '.env');
  try {
    const content = fs.readFileSync(envFile, 'utf8');
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
loadEnv();

// ============ 状态管理 ============
const state = {
  wechat_collect: { status: 'idle', lastRun: null, count: 0, running: false, found: 0 },
  wechat_merge:   { status: 'idle', lastRun: null, count: 0, running: false, newCount: 0 },
  wechat_analyze: { status: 'idle', lastRun: null, count: 0, running: false, done: 0, total: 0 },
  pipeline:       { status: 'idle', lastRun: null, running: false, step: '' },
};
const logs = [];

function addLog(source, msg) {
  const now = new Date();
  const bjTime = new Date(now.getTime() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const entry = { time: bjTime + ' 北京', source, msg };
  logs.unshift(entry);
  if (logs.length > 500) logs.length = 500;
  console.log(`[${bjTime}] [${source}] ${msg}`);
}

// ============ 子进程执行 ============
function runScript(name, script, args = [], extraEnv = {}) {
  return new Promise((resolve) => {
    const displayName = name;
    addLog(displayName, `开始: node ${path.basename(script)} ${args.join(' ')}`);

    const startTime = Date.now();
    const child = spawn('node', [script, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      const lines = d.toString().split('\n').filter(Boolean);
      lines.slice(-3).forEach(l => {
        addLog(displayName, l);
        // 解析进度
        const collMatch = l.match(/\[([^\]]+)\]\s+列表\s+(\d+)/);
        if (collMatch) { state.wechat_collect.found = (state.wechat_collect.found||0) + 1; }
        const mergeMatch = l.match(/微信新增:\s*(\d+)\s*篇/);
        if (mergeMatch) state.wechat_merge.newCount = parseInt(mergeMatch[1]);
        const aiMatch = l.match(/\[(\d+)\/(\d+)\]/);
        if (aiMatch) { state.wechat_analyze.done = parseInt(aiMatch[1]); state.wechat_analyze.total = parseInt(aiMatch[2]); }
      });
    });
    child.stderr.on('data', (d) => {
      d.toString().split('\n').filter(Boolean).slice(-3).forEach(l => addLog(displayName, `[ERR] ${l}`));
    });

    child.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        addLog(displayName, `✅ 完成 (${elapsed}s)`);
        resolve({ ok: true, elapsed, stdout });
      } else {
        addLog(displayName, `❌ 失败 (exit ${code}, ${elapsed}s)`);
        resolve({ ok: false, code, elapsed, stdout: stdout.slice(-500) });
      }
    });
  });
}

// ============ 采集流水线 ============
async function wechatPipeline() {
  if (state.pipeline.running) {
    addLog('pipeline', '流水线正在运行中，跳过');
    return;
  }
  state.pipeline.running = true;
  state.pipeline.step = 'collect';
  state.wechat_collect.found = 0;
  state.wechat_merge.newCount = 0;
  state.wechat_analyze.done = 0;
  state.wechat_analyze.total = 0;

  // Step 1: 微信采集
  state.pipeline.step = 'collect';
  state.wechat_collect.status = 'running'; state.wechat_collect.running = true;
  const collectEnv = {
    WX_EXPORTER_HOST: '47.107.133.169',
    WX_EXPORTER_PORT: '3443',
    WX_EXPORTER_PROTOCOL: 'https',
    CONTENT_CONCURRENCY: '5',
    WX_TLS_REJECT_UNAUTHORIZED: '0',
    WX_FORCE_MODE: 'full',  // 本地控制台: 全量拉取今天文章
  };
  const collectResult = await runScript('📥采集', 'scripts/collect_wechat_smart.cjs', [], collectEnv);
  state.wechat_collect.running = false;
  state.wechat_collect.lastRun = new Date().toISOString();
  state.wechat_collect.status = collectResult.ok ? 'success' : 'error';

  if (!collectResult.ok) {
    addLog('pipeline', '采集失败，流水线中断');
    state.pipeline.running = false;
    return;
  }

  // 统计采集数量
  const wechatFile = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', 'wechat-articles.json');
  try { state.wechat_collect.count = JSON.parse(fs.readFileSync(wechatFile, 'utf-8')).length; } catch {}

  // Step 2: Merge
  state.pipeline.step = 'merge';
  state.wechat_merge.status = 'running'; state.wechat_merge.running = true;
  const mergeResult = await runScript('🔀合并', 'scripts/merge_wechat.cjs');
  state.wechat_merge.running = false;
  state.wechat_merge.lastRun = new Date().toISOString();
  state.wechat_merge.status = mergeResult.ok ? 'success' : 'error';

  // Step 3: AI 分析
  state.pipeline.step = 'analyze';
  state.wechat_analyze.status = 'running'; state.wechat_analyze.running = true;
  const analyzeResult = await runScript('🤖分析', 'scripts/analyze_v3.cjs', ['--limit', '100']);
  state.wechat_analyze.running = false;
  state.wechat_analyze.lastRun = new Date().toISOString();
  state.wechat_analyze.status = analyzeResult.ok ? 'success' : 'error';

  state.pipeline.lastRun = new Date().toISOString();
  state.pipeline.status = analyzeResult.ok ? 'success' : 'partial';
  state.pipeline.running = false;
  addLog('pipeline', '流水线完成');
}

// ============ Express ============
const app = express();
app.use(express.json());

app.post('/api/wechat/collect', async (req, res) => {
  res.json({ status: 'started' });
  wechatPipeline();
});

app.get('/api/status', (req, res) => {
  const dataFiles = {};
  const eventsPath = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', 'events.json');
  const wechatPath = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', 'wechat-articles.json');
  try { if (fs.existsSync(eventsPath)) dataFiles.events = JSON.parse(fs.readFileSync(eventsPath, 'utf-8')).length; } catch { dataFiles.events = 0; }
  try { if (fs.existsSync(wechatPath)) dataFiles.wechat = JSON.parse(fs.readFileSync(wechatPath, 'utf-8')).length; } catch { dataFiles.wechat = 0; }

  // 读取监控公众号列表
  let accounts = [];
  try {
    const mpWatch = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'config', 'mp_watch.json'), 'utf-8'));
    accounts = (mpWatch.accounts || []).map(a => a.name);
  } catch {}

  // 统计今天条数
  const today = new Date();
  today.setHours(today.getHours() + 8);  // 北京时间
  const todayStr = today.toISOString().slice(0, 10);
  let todayCount = 0;
  try {
    if (fs.existsSync(eventsPath)) {
      todayCount = JSON.parse(fs.readFileSync(eventsPath, 'utf-8')).filter(e => (e.publishedAt || e.publishTime || '').startsWith(todayStr)).length;
    }
  } catch {}

  res.json({ state, dataFiles, todayCount, accounts, time: new Date().toISOString() });
});

app.get('/api/logs', (req, res) => res.json(logs.slice(0, 200)));
app.post('/api/logs/clear', (req, res) => { logs.length = 0; res.json({ ok: true }); });

// ============ Web UI ============
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>监管采集控制台</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Segoe UI,sans-serif;background:#0d1117;color:#c9d1d9;padding:24px}
h1{font-size:22px;color:#58a6ff;margin-bottom:4px}
.sub{color:#8b949e;font-size:13px;margin-bottom:20px}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:20px;margin-bottom:16px}
.card h3{font-size:14px;color:#8b949e;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.idle{background:#484f58}.dot.running{background:#d29922;animation:pulse 1s infinite}.dot.success{background:#3fb950}.dot.error{background:#f85149}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.btn{padding:10px 24px;border:1px solid #30363d;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;background:#21262d;color:#c9d1d9;transition:all .15s;margin-right:8px}
.btn:hover{background:#30363d;border-color:#58a6ff}
.btn.big{padding:14px 40px;font-size:16px;background:#238636;border-color:#238636;color:#fff}
.btn.big:hover{background:#2ea043}
.btn.big:disabled{background:#1a4628;border-color:#1a4628;opacity:.6}
.pipeline{display:flex;align-items:center;gap:8px;margin:12px 0}
.step{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 16px;font-size:12px;text-align:center;min-width:90px}
.step .label{color:#8b949e;margin-bottom:4px}
  .step .val{color:#58a6ff;font-weight:bold}
  .step .subtext{font-size:10px;color:#8b949e;margin-top:2px}
  .step.done{border-color:#3fb950}.step.done .val{color:#3fb950}
.arrow{color:#30363d;font-size:18px}
.info{font-size:12px;color:#8b949e;margin-top:8px}.info b{color:#c9d1d9}
.log{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:14px;max-height:460px;overflow-y:auto;font-family:Consolas,monospace;font-size:12px;line-height:1.7}
.log .e{padding:1px 0;white-space:pre-wrap;word-break:break-all}
.log .ts{color:#484f58;margin-right:8px}
.log .src{color:#58a6ff;margin-right:6px;font-weight:bold}
.log .e.done .msg{color:#3fb950}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.stat{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px;text-align:center}
.stat .n{font-size:28px;font-weight:bold;color:#58a6ff}
.stat .l{font-size:11px;color:#8b949e;margin-top:4px}
</style>
</head>
<body>
<h1>📡 监管信息采集控制台</h1>
<p class="sub">完全本地化 · 一键采集 → 自动合并 → AI分析 → 前端展示 | <span id="clock"></span></p>

<div class="stats">
  <div class="stat"><div class="n" id="evCount">—</div><div class="l">events.json</div></div>
  <div class="stat"><div class="n" id="wxCount">—</div><div class="l">微信原始</div></div>
  <div class="stat"><div class="n" id="today">—</div><div class="l">今日新增</div></div>
  <div class="stat"><div class="n" id="acctCount">—</div><div class="l">监控公众号</div></div>
</div>

<div class="card" style="margin-bottom: 16px;">
  <h3>📰 监控公众号列表</h3>
  <div id="acctList" style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;"></div>
</div>

<div class="card">
  <h3>🚀 一键采集微信</h3>
  <p style="font-size:12px;color:#8b949e;margin-bottom:12px">采集 → 合并到 events.json → AI分析（摘要+评分+翻译）→ 前端刷新即见</p>
  <button class="btn big" onclick="trigger()" id="triggerBtn">▶ 采集微信公众号</button>

  <div class="pipeline" style="margin-top:16px">
    <div class="step" id="s1"><div class="label">📥 采集</div><div class="val">等待</div><div class="subtext" id="s1sub"></div></div>
    <div class="arrow">→</div>
    <div class="step" id="s2"><div class="label">🔀 合并</div><div class="val">等待</div><div class="subtext" id="s2sub"></div></div>
    <div class="arrow">→</div>
    <div class="step" id="s3"><div class="label">🤖 AI分析</div><div class="val">等待</div><div class="subtext" id="s3sub"></div></div>
    <div class="arrow">→</div>
    <div class="step" id="s4"><div class="label">✅ 完成</div><div class="val">等待</div></div>
  </div>
</div>

<div class="card">
  <h3>📋 运行日志 <span style="font-size:11px;font-weight:normal;color:#8b949e;margin-left:auto">自动刷新</span></h3>
  <div class="log" id="log"><div class="e">等待任务...</div></div>
  <button class="btn" onclick="clearLogs()" style="margin-top:8px">清空日志</button>
</div>

<script>
const API='';
const pipelineSteps = {running:'⏳ 运行中',success:'✅ 完成',error:'❌ 失败',idle:'等待'};

async function trigger(){
  const btn=document.getElementById('triggerBtn');
  btn.disabled=true;btn.textContent='⏳ 流水线运行中...';
  setStep('s1','running');setStep('s2','idle');setStep('s3','idle');setStep('s4','idle');
  fetch(API+'/api/wechat/collect',{method:'POST'});
  // 轮询直到完成
  const poll=setInterval(async()=>{
    const s=await fetch(API+'/api/status').then(r=>r.json());
    setStep('s1', s.state.wechat_collect.running?'running':s.state.wechat_collect.status, s.state.wechat_collect.found+' 个号');
    setStep('s2', s.state.wechat_merge.running?'running':s.state.wechat_merge.status, '+'+s.state.wechat_merge.newCount+' 篇');
    setStep('s3', s.state.wechat_analyze.running?'running':s.state.wechat_analyze.status, s.state.wechat_analyze.done+'/'+s.state.wechat_analyze.total);
    if(!s.state.pipeline.running){
      setStep('s4','success');
      btn.disabled=false;btn.textContent='▶ 采集微信公众号';
      clearInterval(poll);
      refresh();
    }
  },2000);
}

function setStep(id,status,sub){
  const el=document.getElementById(id);
  el.className='step '+(status==='success'?'done':'');
  el.querySelector('.val').textContent=pipelineSteps[status]||status;
  const subEl=el.querySelector('.subtext');
  if(subEl)subEl.textContent=sub||'';
}

async function refresh(){
  try{
    const s=await fetch(API+'/api/status').then(r=>r.json());
    document.getElementById('evCount').textContent=s.dataFiles.events||0;
    document.getElementById('wxCount').textContent=s.dataFiles.wechat||0;
    document.getElementById('today').textContent=s.todayCount||0;
    document.getElementById('acctCount').textContent=(s.accounts||[]).length;
    const listEl=document.getElementById('acctList');
    listEl.innerHTML=(s.accounts||[]).map(a=>'<span style="background:#21262d;border:1px solid #30363d;border-radius:6px;padding:3px 10px;color:#c9d1d9">'+esc(a)+'</span>').join('');
    const l=await fetch(API+'/api/logs?limit=80').then(r=>r.json());
    document.getElementById('log').innerHTML=l.map(e=>
      '<div class="e'+(e.msg.includes('✅')?' done':'')+'"><span class="ts">'+e.time.slice(11,19)+'</span><span class="src">['+e.source+']</span><span class="msg">'+esc(e.msg)+'</span></div>'
    ).join('')||'<div class="e">等待任务...</div>';
  }catch(e){}
}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function clearLogs(){fetch(API+'/api/logs/clear',{method:'POST'})}
document.getElementById('clock').textContent=new Date().toLocaleString('zh-CN');
setInterval(()=>{document.getElementById('clock').textContent=new Date().toLocaleString('zh-CN')},1000);
setInterval(refresh,3000);
refresh();
</script>
</body>
</html>`);
});

// ============ 启动 ============
app.listen(PORT, () => {
  addLog('system', `控制台已启动: http://localhost:${PORT}`);
  addLog('system', '完全本地化 — 不依赖 GitHub / ECS');
  addLog('system', '自动采集: 每 30 分钟 | 点击按钮可手动触发');
});

// ============ 定时自动采集 ============
setInterval(() => {
  if (!state.pipeline.running) {
    addLog('schedule', '定时触发微信采集');
    wechatPipeline();
  }
}, 30 * 60 * 1000);

addLog('system', '定时器已设置: 每 30 分钟自动采集微信');
