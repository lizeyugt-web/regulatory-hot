# -*- coding: utf-8 -*-
"""
WorkBuddy 反代 SSH 反向隧道守护（Windows → 新ECS）

链路：
  ECS 127.0.0.1:8002  ──SSH反向隧道(22)──>  本机 127.0.0.1:8002 (Antigravity → WorkBuddy 积分)

特性：断线自动重连、保活、日志轮转。
自启：Windows 计划任务「RegSci-WBTunnel」（ONLOGON，pythonw 隐藏运行）。

手动启动:  python scripts/tunnel/wb_tunnel.py
手动停止:  python scripts/tunnel/wb_tunnel.py --stop   (或杀掉 python/ssh 进程)
"""

import os
import subprocess
import sys
import time
import datetime

# ===== 配置 =====
SSH_EXE = r"C:\Windows\System32\OpenSSH\ssh.exe"
KEY = r"C:\Users\zeyuli\.ssh\regsci_tunnel_ed25519"
REMOTE = "root@8.141.89.193"
# ECS 侧绑定 127.0.0.1:8002 → 本机 127.0.0.1:8002
FORWARD = "127.0.0.1:8002:127.0.0.1:8002"
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tunnel.log")
PID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tunnel.pid")
RETRY_DELAY = 8          # 断线重连间隔（秒）
LOG_MAX_BYTES = 2 * 1024 * 1024  # 日志轮转阈值 2MB


def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > LOG_MAX_BYTES:
            # 简单轮转：保留旧日志为 .1
            try:
                os.replace(LOG_FILE, LOG_FILE + ".1")
            except OSError:
                pass
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def build_cmd():
    return [
        SSH_EXE,
        "-N", "-T",
        "-R", FORWARD,
        "-i", KEY,
        "-o", "BatchMode=yes",
        "-o", "ExitOnForwardFailure=yes",
        "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
        "-o", "TCPKeepAlive=yes",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=15",
        REMOTE,
    ]


def main():
    if "--stop" in sys.argv:
        log("手动停止：请直接结束隧道 python 进程与其子 ssh 进程")
        return

    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))

    log(f"隧道守护启动 pid={os.getpid()}  {REMOTE}  -R {FORWARD}")
    failures = 0
    while True:
        try:
            proc = subprocess.Popen(
                build_cmd(),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            log(f"ssh 已启动 pid={proc.pid}")
            _, stderr = proc.communicate()
            rc = proc.returncode
            err = (stderr or b"").decode("utf-8", "ignore").strip()[-300:]
            failures += 1
            log(f"ssh 退出 rc={rc}（第 {failures} 次）{err}")
        except Exception as e:  # noqa: BLE001
            failures += 1
            log(f"启动异常（第 {failures} 次）: {e}")

        delay = min(RETRY_DELAY * max(1, failures), 120)  # 退避上限 2 分钟
        log(f"{delay}s 后重连...")
        time.sleep(delay)


if __name__ == "__main__":
    main()
