# -*- coding: utf-8 -*-
"""
WorkBuddy 反代 SSH 反向隧道守护（Windows → 新ECS + 旧服务器）

链路：
  新ECS  127.0.0.1:8002 ─┐
                          ├──SSH反向隧道(22)──> 本机 127.0.0.1:8002 (Antigravity → WorkBuddy 积分)
  旧服务器 127.0.0.1:8002 ─┘

特性：每个目标独立重连、保活、日志轮转。
自启：Windows 启动文件夹「RegSci-WBTunnel.vbs」（pythonw 隐藏运行）。

手动启动:  python scripts/tunnel/wb_tunnel.py
"""

import os
import subprocess
import sys
import time
import datetime

# ===== 配置 =====
SSH_EXE = r"C:\Windows\System32\OpenSSH\ssh.exe"
KEY = r"C:\Users\zeyuli\.ssh\regsci_tunnel_ed25519"
# (SSH目标, 远端绑定) — 远端 127.0.0.1:8002 → 本机 127.0.0.1:8002
TARGETS = [
    ("root@8.141.89.193", "127.0.0.1:8002:127.0.0.1:8002"),    # 新ECS（生产 regsci.cn）
    ("root@47.107.133.169", "127.0.0.1:8002:127.0.0.1:8002"),  # 旧轻量云（reg-daemon 采集分析）
]
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "tunnel.log")
PID_FILE = os.path.join(BASE_DIR, "tunnel.pid")
CHECK_INTERVAL = 5       # 进程健康检查间隔（秒）
RETRY_DELAY = 8          # 断线基础重连间隔（秒）
LOG_MAX_BYTES = 2 * 1024 * 1024


def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > LOG_MAX_BYTES:
            try:
                os.replace(LOG_FILE, LOG_FILE + ".1")
            except OSError:
                pass
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def build_cmd(remote, forward):
    return [
        SSH_EXE,
        "-N", "-T",
        "-R", forward,
        "-i", KEY,
        "-o", "BatchMode=yes",
        "-o", "ExitOnForwardFailure=yes",
        "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
        "-o", "TCPKeepAlive=yes",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=15",
        remote,
    ]


def main():
    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))

    log(f"隧道守护启动 pid={os.getpid()}  目标数={len(TARGETS)}")
    procs = {}    # remote -> Popen
    fails = {}    # remote -> 连续失败次数
    next_try = {} # remote -> 下次允许重试的时间戳

    while True:
        now = time.time()
        for remote, forward in TARGETS:
            proc = procs.get(remote)
            alive = proc is not None and proc.poll() is None
            if alive:
                continue

            if proc is not None:
                # 刚退出
                fails[remote] = fails.get(remote, 0) + 1
                backoff = min(RETRY_DELAY * fails[remote], 120)
                next_try[remote] = now + backoff
                log(f"[{remote}] ssh 退出 rc={proc.returncode}（第 {fails[remote]} 次），{backoff}s 后重连")
                procs[remote] = None
                continue

            if now < next_try.get(remote, 0):
                continue

            try:
                p = subprocess.Popen(
                    build_cmd(remote, forward),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                procs[remote] = p
                log(f"[{remote}] ssh 已启动 pid={p.pid}  -R {forward}")
            except Exception as e:  # noqa: BLE001
                fails[remote] = fails.get(remote, 0) + 1
                next_try[remote] = now + min(RETRY_DELAY * fails[remote], 120)
                log(f"[{remote}] 启动异常（第 {fails[remote]} 次）: {e}")

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
