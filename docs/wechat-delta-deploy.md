# 微信公众号高频增量采集 — 阿里云部署指南

## 架构概览

```
阿里云 47.107.133.169
├── Docker: wechat-article-exporter (:3443)          ← 已有
├── cron: collect_wechat_delta.cjs  (每5分钟)        ← 新增
│   ├── 轮询 /api/public/v1/article (每账号 5 篇)
│   ├── ID 增量比对 → 仅处理新文章
│   ├── 抓正文 → 写入 wechat-articles.json
│   └── git push → 触发 GitHub Actions (AI 分析)
│
GitHub Actions (每2小时兜底)
├── FDA 全量采集
├── 微信全量采集（20篇/号）
└── AI 批量分析
```

## 前提条件

阿里云服务器上需要：
- Node.js >= 18
- Git（已克隆 `lizeyugt-web/regulatory-hot` 仓库）
- 能够访问 `localhost:3443`（wechat-article-exporter）
- GitHub Personal Access Token（用于 push + 触发 workflow）
- 有效的 `WECHAT_AUTH_KEY`

## 部署步骤

### Step 1: SSH 登录阿里云

```bash
ssh root@47.107.133.169
```

### Step 2: 确认环境

```bash
node -v          # 需要 >= 18
git --version
which node
```

如果缺 Node.js：
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
```

### Step 3: 克隆仓库（如果还没有）

```bash
cd /opt
git clone https://github.com/lizeyugt-web/regulatory-hot.git
cd regulatory-hot
```

如果已存在，先拉取最新代码：
```bash
cd /opt/regulatory-hot
git pull
```

### Step 4: 创建环境变量文件

```bash
cat > /opt/regulatory-hot/.env.watcher << 'EOF'
# 微信采集
WX_EXPORTER_HOST=127.0.0.1        # 同机 Docker，用 localhost
WX_EXPORTER_PORT=3443
WX_EXPORTER_PROTOCOL=https
WX_TLS_REJECT_UNAUTHORIZED=1       # 自签证书，允许
WX_AUTH_KEY=<从 GitHub Secrets 获取>

# 增量采集
DELTA_ARTICLE_LIMIT=5
DELTA_CONTENT_CONCURRENCY=3
DELTA_AUTO_PUSH=1

# GitHub
GITHUB_TOKEN=<你的 Personal Access Token>
GITHUB_REPOSITORY=lizeyugt-web/regulatory-hot
EOF
```

**⚠️ 填入实际的 WX_AUTH_KEY 和 GITHUB_TOKEN**

获取 WX_AUTH_KEY：
1. 浏览器访问 https://47.107.133.169:3443/dashboard/account
2. 扫码登录
3. F12 → Application → Cookies → 复制 `auth-key` 的值
4. 有效期约 4 天，过期需重新获取

获取 GITHUB_TOKEN：
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 权限：`Contents: Read & Write` + `Actions: Read & Write`
3. 仅授权 `lizeyugt-web/regulatory-hot` 仓库

### Step 5: 测试脚本

```bash
cd /opt/regulatory-hot
source .env.watcher
node scripts/collect_wechat_delta.cjs --dry-run
```

预期输出：
```
[delta] ======== 2026-07-09T... 增量采集开始 ========
[delta] Auth-key 有效
[delta] [中国药闻] 0 篇新 → 命中缓存(5/5)
[delta] [蒲公英] 2 篇新 → 命中缓存(3/5)
...
[delta] 共 X 篇新文章
[delta] ======== 完成: X 篇新, 耗时 Y.Ys ========
```

确认无误后，去掉 `--dry-run` 正式跑一次：
```bash
node scripts/collect_wechat_delta.cjs
```

### Step 6: 配置 cron 定时任务

```bash
crontab -e
```

添加以下行（每 5 分钟运行一次）：

```cron
# 微信公众号增量采集 — 每 5 分钟
*/5 * * * * cd /opt/regulatory-hot && source .env.watcher && /usr/bin/node scripts/collect_wechat_delta.cjs >> /var/log/wechat-delta.log 2>&1

# 日志轮转 — 每天凌晨 3 点截断
0 3 * * * truncate -s 0 /var/log/wechat-delta.log
```

### Step 7: 验证 cron 正常运行

```bash
# 等待 5 分钟，查看日志
tail -50 /var/log/wechat-delta.log

# 预期看到类似输出：
# [delta] ======== 2026-07-09T08:35:00... 增量采集开始 ========
# [delta] Auth-key 有效
# ...（可能全部命中缓存，0 篇新文章属于正常）
```

### Step 8: 监控告警（可选）

Auth-key 过期时脚本 exit code = 2，可通过 cron 的 MAILTO 接收邮件通知。

```bash
crontab -e
# 在文件顶部添加：
MAILTO=your-email@example.com
```

或在脚本中添加飞书/钉钉 webhook 通知（后续迭代）。

## 运行模式对照表

| 触发方式 | 频率 | 做什么 | 意义 |
|----------|------|--------|------|
| 阿里云 cron | 每 5 分钟 | 微信增量采集 + git push + 触发 CI | **准实时**捕获新文章 |
| GitHub Actions `full` | 每 2 小时 | FDA 全量 + 微信全量 + AI 分析 | **兜底**防遗漏 |
| GitHub Actions `ai-only` | delta 触发 | 仅合并+AI分析 | **被 watcher 触发**，数据已推送 |

## 效果预期

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| 公众号发文章 → 站上可见 | ≤ 2 小时 + 分析时间 | ≤ 5~8 分钟（含 AI 分析） |
| 单次采集耗时 | ~3 分钟（全量 20 篇×10 号） | ~15 秒（增量 5 篇，通常缓存命中） |
| API 调用量 | 每 2h 全量 | 每 5min 增量 + 每 2h 全量兜底 |
| Auth-key 过期检测 | 下次全量采集才发现 | 5 分钟内发现（exit code 2） |

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `Auth-key 失效` | 4 天过期 | 重新扫码登录 https://47.107.133.169:3443/dashboard/account |
| `WX_AUTH_KEY 未配置` | env 未加载 | 检查 `.env.watcher` 是否存在且 source 生效 |
| `git push 失败` | GITHUB_TOKEN 过期或无权限 | 重新生成 token |
| `fakeid 缓存失效` | 公众号改名/取消关注 | 删除 `config/mp_fakeid_cache.json` 让脚本重新匹配 |
| 脚本一直 0 篇新（但实际有新文章） | fakeid 匹配异常 | 运行 `node scripts/collect_wechat_v2.cjs` 全量版看实际 fakeid |

## 注意事项

1. **首次运行** delta 脚本时，所有文章都是"新"的（没有 lastArticleId 缓存）。第一次可能采集几十篇，之后每 5 分钟通常 0~3 篇。
2. **cron 环境**中 Node.js 路径可能不同于交互 shell。用 `which node` 确认绝对路径。
3. **Git 冲突**：delta watcher 和 GitHub Actions 可能同时 push，导致冲突。脚本会自然失败并记录日志（不影响下次运行）。
4. **日志大小**：已配置每天 3 点截断日志，避免磁盘占满。
