# 阿里云 ECS 全量部署可行性分析

> 日期：2026-07-10  
> 目标：将监管信息采集监控平台全部组件部署到阿里云 ECS (47.107.133.169)，实现完全自主运行

---

## 一、ECS 现状

### 硬件配置

| 项目 | 规格 |
|------|------|
| CPU | 2 核 |
| RAM | 1.8 GiB（可用 ~951 MB） |
| 磁盘 | 40 GB（可用 23 GB） |
| Swap | 无 |
| 系统 | Alibaba Cloud Linux 3 (RHEL 兼容) |

### 已运行服务（6 个）

| 服务 | 端口 | 技术 | 内存估算 |
|------|------|------|---------|
| wechat-article-exporter | 3099 (Docker, nginx反向代理 3443) | Docker Node.js | ~250 MB |
| pharma-tracker | 3000 | Next.js 14 (cluster) | ~200 MB |
| wewe-rss | 内部 | Node.js | ~80 MB |
| mp-watcher | — | Node.js (PM2) | ~60 MB |
| Nginx | 80, 3443 | Nginx | ~20 MB |
| frps + Python×2 | 7000, 17456, 23000, 23002 | Go/Python | ~100 MB |
| **OS 基础** | — | — | ~200 MB |
| **合计占用** | | | **~910 MB** |
| **剩余可用** | | | **~930 MB** |

---

## 二、需要新增的组件

| 组件 | 用途 | 峰值内存 | 磁盘 |
|------|------|---------|------|
| **Chromium (Playwright)** | FDA 网页爬取 | ~400 MB | ~500 MB |
| **regulatory-hot Next.js** | 前端展示 | ~200 MB | ~30 MB |
| **AI 分析子进程** | analyze_v3.cjs | ~150 MB | — |
| **local_daemon → ecs_daemon** | 统一调度 | ~80 MB | — |
| **Prisma + node_modules** | 数据库访问 | — | ~300 MB |
| **新增合计** | | **~830 MB 峰值** | **~830 MB** |

---

## 三、内存评估（关键瓶颈）

```
ECS 总内存:              1,843 MB
当前服务占用:             ~910 MB
新增组件峰值:             ~830 MB
─────────────────────────────────
需求合计:               ~1,740 MB
剩余余量:                 ~103 MB  ⚠️ 非常紧张！
```

### 并发场景分析

local_daemon 的调度逻辑是**串行**执行的：

```
[微信导入] → [FDA 采集] → [AI 分析] → [git push]
(50MB)       (400MB)      (150MB)     (30MB)
```

**最多同时存在**: FDA 采集 + Next.js + 基础服务 = ~400 + 200 + 910 = **~1,510 MB**，余量 333 MB ✅

**关键**: 不能让 FDA 采集与 AI 分析同时运行。当前 `local_daemon.cjs` 已经是串行的，符合要求。

### 结论

**✅ 可行，但余量紧张。** 需要在 daemon 中加入内存保护逻辑（检测可用内存 <200MB 时跳过 FDA 采集）。

---

## 四、端口规划

ECS 端口分配（当前 → 规划）：

| 端口 | 当前 | 规划后 |
|------|------|--------|
| 80 | Nginx | Nginx（增加 regulatory-hot 反向代理） |
| 3000 | pharma-tracker (Next.js) | **停止** 或 改为 regulatory-hot |
| 3099 | wechat-exporter Docker | 不变 |
| 3443 | Nginx → wechat-exporter | 不变 |
| 3456 | 空 | — |
| 3457 | 空 | **regulatory-hot Next.js** |

推荐：regulatory-hot 部署在 **3457** 端口，通过 Nginx 在 80 端口反向代理。

---

## 五、部署步骤

### 第一步：环境准备

```bash
# 1. 拉取最新代码
cd /root/regulatory-hot
git pull origin main

# 2. 安装 Prisma + npm 依赖
cd regulatory-hot
npm install --no-save @prisma/client@7 @prisma/adapter-libsql@7

# 3. 安装 Chromium（FDA 网页爬取）
npx playwright install --with-deps chromium
# 注意: --with-deps 会安装系统库 (~500MB)

# 4. 配置 .env（从本地复制，含 SILICONFLOW_API_KEY）
cat > .env << 'EOF'
SILICONFLOW_API_KEY=sk-ewvbhenqpxihzuuztmvqowkilwnmcqsrrzwtdwqmfyebpkxp
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
PRE_FILTER_MODEL=deepseek-ai/DeepSeek-V3.2
SCORING_MODEL=deepseek-ai/DeepSeek-V3.1-Terminus
SILICONFLOW_MODEL=Qwen/Qwen2.5-72B-Instruct
AI_CONCURRENCY=8
NEXT_PUBLIC_SITE_URL=http://47.107.133.169:3457
WX_AUTH_KEY=def858160e3441dd88a377cba24ce0be
EOF
```

### 第二步：创建 ECS 版守护进程

复制 `scripts/local_daemon.cjs` → `scripts/ecs_daemon.cjs`，做以下修改：

1. **微信导入不再需要 git pull** — watcher 已写入本地 `wechat-articles.json`
2. **移除 `--assume-unchanged` 逻辑** — Linux 无 SQLite 锁问题
3. **添加内存检测** — 可用内存 <200MB 时跳过 FDA Playwright，降级为 RSS-only
4. **git push 改为可选**（作为 GitHub 备份）

### 第三步：创建 PM2 配置

创建 `ecosystem.ecs.config.cjs`：

```javascript
module.exports = {
  apps: [
    {
      name: 'reg-daemon',
      script: 'scripts/ecs_daemon.cjs',
      cwd: '/root/regulatory-hot',
      env: {
        NODE_ENV: 'production',
        LOCAL_DAEMON_INTERVAL: '30',
        LOCAL_FDA_INTERVAL: '4',
        LOCAL_ANALYZE_LIMIT: '100',
        MEMORY_LIMIT_MB: '200',
      },
      autorestart: true,
      max_memory_restart: '300M',
      error_file: '/root/regulatory-hot/logs/ecs-daemon-err.log',
      out_file: '/root/regulatory-hot/logs/ecs-daemon-out.log',
    },
    {
      name: 'reg-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3457 -H 0.0.0.0',
      cwd: '/root/regulatory-hot/regulatory-hot',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};
```

### 第四步：构建 & 启动

```bash
# 构建前端
cd /root/regulatory-hot/regulatory-hot
npx next build

# 停止 pharma-tracker（可选，释放端口 3000 和 ~200MB RAM）
pm2 stop pharma-tracker

# 启动守护进程 + 前端
cd /root/regulatory-hot
pm2 start ecosystem.ecs.config.cjs
pm2 save

# 配置 Nginx 反向代理（前端访问）
# nginx conf: proxy_pass http://127.0.0.1:3457;
nginx -s reload
```

---

## 六、运行维护

### 日常监控

```bash
# 查看所有服务状态
pm2 status

# 查看 daemon 日志
pm2 logs reg-daemon

# 查看内存使用
free -h

# 查看磁盘
df -h /
```

### 更新代码

```bash
cd /root/regulatory-hot
git pull origin main
cd regulatory-hot
npm install --no-save @prisma/client@7 @prisma/adapter-libsql@7
pm2 restart all
```

### 添加新公众号

```bash
# 编辑 config/mp_watch.json 添加公众号
# wacher 下个周期自动生效（无需重启）
```

### 添加新信源（EMA/NMPA等）

本地开发 → 测试通过 → git push → ECS `git pull` → `pm2 restart reg-daemon`

---

## 七、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| **内存不足 (OOM)** | 服务崩溃 | daemon 内置内存检测，<200MB 降级为 RSS-only；PM2 `max_memory_restart` 自动重启 |
| **Chromium 崩溃** | FDA 网页采集失败 | daemon 自动降级为 RSS-only；不影响微信采集和 AI 分析 |
| **Docker wechat-exporter 挂掉** | 微信文章断流 | watcher 重试机制；PM2 不影响，等 Docker 恢复后自动追补 |
| **硅基流动 API 限流** | AI 分析暂停 | analyze_v3.cjs 内置重试（429 自动退避） |
| **磁盘写满 (regulatory.db)** | 写入失败 | regulatory.db 增长极慢 (~5MB/月)；23GB 可用空间充足 |
| **端口冲突** | 前端无法访问 | 使用独立端口 3457，与现有服务无冲突 |

---

## 八、总成本

| 项目 | 现状 | 全量部署后 |
|------|------|-----------|
| ECS 费用 | 现有 (2C2G) | **不变**（同一台机器） |
| 硅基流动 API | ~¥1/月 | **不变** |
| 运维时间 | — | ~10 分钟/月（git pull + 重启） |
| 稳定性 | 依赖本地 Windows | **7×24 独立运行** |

---

## 九、结论

### ✅ 可行，推荐部署

| 维度 | 评估 |
|------|------|
| **技术可行性** | ✅ 高。ECS 已有 Node/Git/PM2/Docker/Playwright，仅需补充依赖 |
| **资源可行性** | ⚠️ 内存紧张但可管理（串行执行 + 内存保护） |
| **维护可行性** | ✅ 高。PM2 自动管理，每月只需 git pull 更新 |
| **稳定性** | ✅ 比本地方案更稳定（7×24，不断电不断网） |
| **风险** | 中等。内存是最关键的约束，需加保护逻辑 |

### 推荐策略：渐进部署

```
Phase 1 (当天)：
  1. 安装 Prisma + 配置 .env
  2. SSH 试跑: node scripts/local_daemon.cjs --ai-only
  3. 验证 API Key、DB 读写正常

Phase 2 (当天)：
  1. 安装 Chromium (npx playwright install chromium --with-deps)
  2. 试跑: node scripts/local_daemon.cjs --fda-only
  3. 验证 FDA RSS + Web 采集正常

Phase 3：
  1. 创建 ecs_daemon.cjs（去掉 git pull，加内存保护）
  2. 创建 ecosystem.ecs.config.cjs
  3. 构建 Next.js 前端
  4. pm2 start + Nginx 配置

Phase 4（稳定后）：
  1. 本地机器可以关机（不再需要常驻）
  2. 飞书/邮件日报推送（可选）
```

---

> **一句话总结**: ECS 1.8GB 内存可以跑下全量采集+分析+前端，但需要做好内存保护。部署后彻底摆脱对本地 Windows 的依赖。
