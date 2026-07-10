#!/usr/bin/env python3
"""修复 Nginx regulatory 路由"""

import re

with open('/etc/nginx/conf.d/zhenyan.conf', 'r') as f:
    content = f.read()

# 删除所有旧的 regulatory 块
content = re.sub(r'[ \t]*# =+\s*监管信息采集监控平台\s*=+.*?(?=\n\s*location)', '', content, flags=re.DOTALL)

# 找到 server { 块
server_start = content.index('server {')
brace_count = 0
server_end = None
for i in range(server_start, len(content)):
    if content[i] == '{': brace_count += 1
    elif content[i] == '}':
        brace_count -= 1
        if brace_count == 0:
            server_end = i
            break

# 在 server 块的 location 之前插入
regulatory = '''
    # ===== 监管信息采集监控平台 =====
    location = /regulatory { return 301 $scheme://$host/regulatory/; }
    location /regulatory/ {
        proxy_pass http://127.0.0.1:3457/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
'''
server_block = content[server_start:server_end+1]
# insert before first location
loc_idx = server_block.index('location ')
new_block = server_block[:loc_idx] + regulatory + server_block[loc_idx:]
content = content[:server_start] + new_block + content[server_end+1:]

with open('/etc/nginx/conf.d/zhenyan.conf', 'w') as f:
    f.write(content)

import os
os.system('nginx -t && nginx -s reload && echo "OK" || echo "FAIL"')
