/**
 * Cookie 过期检查 & 通知脚本 (check_cookie.cjs)
 * 
 * v3.0 (2026-07-08): 默认端口从 3099 改为 3443 (HTTPS)
 * 
 * 部署到阿里云 /opt/wechat-exporter/
 * crontab 配置: 0 9,21 * * * node /opt/wechat-exporter/check_cookie.cjs
 * （每天北京时间 9:00 和 21:00 检查）
 * 
 * 功能：
 *   1. 调用 wechat-article-exporter (47.107.133.169:3443) 的 authkey 接口探活
 *   2. 如果返回 code != 0（session 过期），发送通知提醒扫码续期
 *   3. 如果 API 连接失败（容器未运行），也发送通知
 * 
 * 通知方式（按优先级）：
 *   - 飞书 Webhook（如果配置了 FEISHU_WEBHOOK_URL）
 *   - 企业微信 Webhook（如果配置了 WECOM_WEBHOOK_URL）
 *   - 本地日志文件
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
// v3.0: 默认 3443/HTTPS
const EXPORTER_PORT = parseInt(process.env.WX_EXPORTER_PORT || '3443');
const EXPORTER_HOST = process.env.WX_EXPORTER_HOST || '47.107.133.169';
const EXPORTER_PROTOCOL = process.env.WX_EXPORTER_PROTOCOL || 'https';
const WX_AUTH_KEY = process.env.WX_AUTH_KEY || '';
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK_URL || '';
const WECOM_WEBHOOK = process.env.WECOM_WEBHOOK_URL || '';
const LOG_FILE = '/var/log/wechat-cookie-check.log';

// ============ 工具函数 ============
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

function httpGet(url) {
  return new Promise((resolve) => {
    const transport = url.startsWith('https') ? https : http;
    transport.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', (e) => resolve({ status: 0, error: e.message }));
  });
}

// ============ 核心检查 ============
async function checkSession() {
  return new Promise((resolve) => {
    const transport = EXPORTER_PROTOCOL === 'https' ? https : http;
    const headers = { 'Accept': 'application/json' };
    if (WX_AUTH_KEY) {
      headers['X-Auth-Key'] = WX_AUTH_KEY;
      headers['Cookie'] = `auth-key=${WX_AUTH_KEY}`;
    }
    const req = transport.get(
      `${EXPORTER_PROTOCOL}://${EXPORTER_HOST}:${EXPORTER_PORT}/api/public/v1/authkey`,
      { timeout: 10000, headers },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const code = json?.code;
            if (code === 0) {
              resolve({
                healthy: true,
                authenticated: true,
                reason: 'ok',
                detail: 'Auth-key 有效，认证正常',
              });
            } else if (code === -1) {
              resolve({
                healthy: true,
                authenticated: false,
                reason: 'authkey_not_found',
                detail: '微信公众平台登录已过期或 auth-key 失效，需要重新扫码登录',
              });
            } else {
              resolve({
                healthy: true,
                authenticated: false,
                reason: `code=${code}`,
                detail: `未知返回码: code=${code}，msg=${json?.msg || ''}`,
              });
            }
          } catch {
            resolve({
              healthy: true,
              authenticated: false,
              reason: 'parse_error',
              detail: 'API 返回格式异常',
            });
          }
        });
      }
    );
    req.on('error', (e) => {
      resolve({
        healthy: false,
        authenticated: false,
        reason: 'connection_error',
        detail: `无法连接 wechat-article-exporter ${EXPORTER_PROTOCOL}://${EXPORTER_HOST}:${EXPORTER_PORT}: ${e.message}`,
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({
        healthy: false,
        authenticated: false,
        reason: 'timeout',
        detail: 'wechat-article-exporter 连接超时',
      });
    });
  });
}

// ============ 通知发送 ============
async function sendNotification(title, content) {
  const message = `${title}\n\n${content}\n\n时间: ${new Date().toLocaleString('zh-CN')}\n服务器: 47.107.133.169`;
  
  // 飞书通知
  if (FEISHU_WEBHOOK) {
    try {
      const body = JSON.stringify({
        msg_type: 'text',
        content: { text: message }
      });
      await new Promise((resolve) => {
        const url = new URL(FEISHU_WEBHOOK);
        const req = https.request({
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }, (res) => { res.on('end', resolve); });
        req.on('error', resolve);
        req.write(body);
        req.end();
      });
      log('✅ 飞书通知已发送');
    } catch (e) {
      log(`⚠️ 飞书通知失败: ${e.message}`);
    }
  }
  
  // 企业微信通知
  if (WECOM_WEBHOOK) {
    try {
      const body = JSON.stringify({
        msgtype: 'text',
        text: { content: message }
      });
      await new Promise((resolve) => {
        const url = new URL(WECOM_WEBHOOK);
        const req = https.request({
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }, (res) => { res.on('end', resolve); });
        req.on('error', resolve);
        req.write(body);
        req.end();
      });
      log('✅ 企业微信通知已发送');
    } catch (e) {
      log(`⚠️ 企业微信通知失败: ${e.message}`);
    }
  }
}

// ============ 主流程 ============
async function main() {
  log('========================================');
  log('🔍 检查 wechat-article-exporter Cookie 状态');
  
  const status = await checkSession();
  
  if (!status.healthy) {
    log(`❌ 容器不可用: ${status.detail}`);
    await sendNotification(
      '⚠️ [Regulatory Hot] wechat-article-exporter 容器异常',
      `错误: ${status.detail}\n请检查 Docker 容器是否正常运行。`
    );
  } else if (!status.authenticated) {
    log(`⚠️ Auth-key 已失效: ${status.detail}`);
    await sendNotification(
      '🔐 [Regulatory Hot] 微信扫码登录已过期，请重新扫码',
      `原因: ${status.detail}\n\n请访问 https://47.107.133.169:3443/dashboard/account 重新扫码登录。\n登录后 Cookie 有效期约 4 天。`
    );
  } else {
    log(`✅ Cookie 有效，一切正常`);
  }
  
  log('========================================\n');
}

main().catch(e => {
  log(`💥 脚本异常: ${e.message}`);
});
