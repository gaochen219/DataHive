#!/bin/bash
set -e

# 安装依赖（生产环境建议用 npm ci）
npm install

# 构建项目
npm run build

# ⚠️ 关键：用 exec 启动最终进程
# exec 会用 node/npm 进程替换当前 shell 进程（PID 不变）
# 这样 Supervisor 就能直接管理到实际的服务进程
pm2 start .output/server/index.mjs --name nuxt-server