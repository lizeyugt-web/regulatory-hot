#!/usr/bin/env python3
"""重建 zhenyan.conf — 正确插入 regulatory 路由"""

import re

with open('/etc/nginx/conf.d/zhenyan.conf', 'r') as f:
    content = f.read()

# 完全重建: 删除所有旧的 regulatory 相关行
lines = content.split('\n')
new_lines = []
skip_old_reg = False
seen_location = False

for i, line in enumerate(lines):
    if '===== 监管信息采集监控平台 =====' in line:
        skip_old_reg = True
        continue
    if skip_old_reg:
        if line.strip() == '}' and not seen_location:
            # Closing brace of regulatory block
            skip_old_reg = False
            continue
        continue
    
    # 在第一个 add_header 之后、第一个 location 之前插入
    if not seen_location and 'add_header Referrer-Policy' in line:
        new_lines.append(line)
        new_lines.append('')
        new_lines.append('    # ===== 监管信息采集监控平台 =====')
        new_lines.append('    location = /regulatory { return 301 /regulatory/; }')
        new_lines.append('    location /regulatory/ {')
        new_lines.append('        proxy_pass http://127.0.0.1:3457/;')
        new_lines.append('        proxy_http_version 1.1;')
        new_lines.append('        proxy_set_header Upgrade $http_upgrade;')
        new_lines.append('        proxy_set_header Connection "upgrade";')
        new_lines.append('        proxy_set_header Host $host;')
        new_lines.append('        proxy_set_header X-Real-IP $remote_addr;')
        new_lines.append('        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
        new_lines.append('    }')
        new_lines.append('')
        continue
    
    if line.strip().startswith('location '):
        seen_location = True
    
    new_lines.append(line)

with open('/etc/nginx/conf.d/zhenyan.conf', 'w') as f:
    f.write('\n'.join(new_lines))

import subprocess
r1 = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
print(r1.stdout)
print(r1.stderr)
if r1.returncode == 0:
    r2 = subprocess.run(['nginx', '-s', 'reload'])
    print('✅ Nginx reloaded')
else:
    print('❌ Config error')
