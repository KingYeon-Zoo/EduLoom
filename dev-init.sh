#!/bin/bash
# EduLoom 本地开发环境初始化与服务启动脚本
# 默认 SurrealDB 按照配置已在本地运行

set -e

# ANSI 颜色配置
PURPLE='\033[1;35m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
BLUE='\033[1;34m'
NC='\033[0m' # 重置颜色

# 打印炫酷的 ASCII Art 标志
echo -e "${PURPLE}"
echo "    ______    __        __"
echo "   / ____/___/ /_  __  / /   ____  ____  ____ ___"
echo "  / __/ / __  / / / / / /   / __ \/ __ \/ __ \`__ \\"
echo " / /___/ /_/ / /_/ / / /___/ /_/ / /_/ / / / / / /"
echo "/_____/\__,_/\__,_/ /_____/\____/\____/_/ /_/ /_/"
echo -e "${NC}"
echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}🚀  EduLoom 环境初始化与服务启动...${NC}"
echo -e "${CYAN}======================================================${NC}"

# 检测 SurrealDB 连接状态
SURREAL_PORT=${SURREAL_PORT:-8000}
echo -e "${YELLOW}🔍 正在检查 SurrealDB 连接状态 (端口: $SURREAL_PORT)...${NC}"
if ! nc -z localhost "$SURREAL_PORT" 2>/dev/null; then
  echo -e "${RED}❌ 端口 $SURREAL_PORT 上的 SurrealDB 无法连接。请先确保其正在运行。${NC}"
  exit 1
fi
echo -e "${GREEN}✓ SurrealDB 连接测试成功！${NC}"

# 安装并同步 Python 依赖
echo -e "${YELLOW}⚡ 正在使用 uv 同步 Python 后端依赖...${NC}"
uv sync
echo -e "${GREEN}✓ Python 依赖已同步完成${NC}"

# 安装前端依赖
echo -e "${YELLOW}⚡ 正在同步前端 Node.js 依赖...${NC}"
cd frontend && npm install && cd ..
echo -e "${GREEN}✓ 前端依赖同步完成${NC}"

# 在后台启动 API 后端
echo -e "${YELLOW}⚡ 正在启动 FastAPI 后端 API (端口: 5055)...${NC}"
uv run --env-file .env run_api.py &
sleep 3

# 在后台启动异步指令 Worker
echo -e "${YELLOW}⚡ 正在启动后台异步任务 Worker...${NC}"
PYTHONIOENCODING=utf-8 uv run --env-file .env surreal-commands-worker --import-modules commands &
sleep 2

# 启动 Next.js 前端 (前台运行)
echo -e "${CYAN}------------------------------------------------------${NC}"
echo -e "${GREEN}🎉 所有 EduLoom 本地服务均已同步并启动！${NC}"
echo -e "${BLUE}👉 前端地址:   http://localhost:3000${NC}"
echo -e "${BLUE}👉 API 接口:   http://localhost:5055${NC}"
echo -e "${BLUE}👉 API 文档:   http://localhost:5055/docs${NC}"
echo -e "${CYAN}------------------------------------------------------${NC}"
echo ""

cd frontend && npm run dev
