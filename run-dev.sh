#!/bin/bash

# Configuration
DB_DIR="./surreal_data"
API_PORT=5055
DB_PORT=8000
FRONTEND_PORT=3000

# ANSI 颜色配置
PURPLE='\033[1;35m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
BLUE='\033[1;34m'
NC='\033[0m' # 重置颜色

# 清理后台服务的函数
cleanup() {
    echo ""
    echo -e "${RED}======================================================${NC}"
    echo -e "${RED}🛑 正在停止所有 EduLoom 本地服务...${NC}"
    echo -e "${RED}======================================================${NC}"
    
    # 终止当前 shell 进程的所有后台作业
    kill $(jobs -p) 2>/dev/null
    
    # 再次检索并彻底结束相关守护进程
    pkill -f "surreal start.*rocksdb:$DB_DIR" 2>/dev/null
    pkill -f "run_api.py" 2>/dev/null
    pkill -f "surreal-commands-worker" 2>/dev/null
    pkill -f "next-dev" 2>/dev/null
    
    echo -e "${GREEN}✓ 所有后台进程已安全退出。EduLoom 期待下一次与您对齐！🍀${NC}"
    exit 0
}

# 捕获 Ctrl+C (SIGINT) 和 SIGTERM
trap cleanup SIGINT SIGTERM

# 打印炫酷的 ASCII Art 标志
echo -e "${PURPLE}"
echo "    ______    __        __"
echo "   / ____/___/ /_  __  / /   ____  ____  ____ ___"
echo "  / __/ / __  / / / / / /   / __ \/ __ \/ __ \`__ \\"
echo " / /___/ /_/ / /_/ / / /___/ /_/ / /_/ / / / / / /"
echo "/_____/\__,_/\__,_/ /_____/\____/\____/_/ /_/ /_/"
echo -e "${NC}"
echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}🚀  EduLoom 本地开发环境正在启动...${NC}"
echo -e "${CYAN}======================================================${NC}"

# 0. 首次启动时恢复内置演示数据与安全的本地配置
./scripts/bootstrap-demo-data.sh

# 1. 确保 uv 存在
if ! command -v uv &> /dev/null && [ ! -f "$HOME/.local/bin/uv" ]; then
    echo -e "${RED}❌ 找不到 uv 包管理器，请先运行安装或配置 PATH。${NC}"
    exit 1
fi

UV_CMD="uv"
if [ -f "$HOME/.local/bin/uv" ]; then
    UV_CMD="$HOME/.local/bin/uv"
fi

# 2. 检查 SurrealDB 是否已安装
if ! command -v surreal &> /dev/null; then
    echo -e "${RED}❌ 找不到 surreal 数据库，请确保已安装 (brew install surrealdb/tap/surreal)。${NC}"
    exit 1
fi

# 3. 启动 SurrealDB
echo -e "${YELLOW}⚡ 正在启动 SurrealDB 本地数据库 (端口 $DB_PORT)...${NC}"
mkdir -p "$DB_DIR"
surreal start --log info --user root --pass root --bind 127.0.0.1:$DB_PORT rocksdb:$DB_DIR/mydatabase.db > surrealdb.log 2>&1 &

# 等待数据库就绪
sleep 2
if ! nc -z 127.0.0.1 $DB_PORT; then
    echo -e "${RED}❌ 数据库启动失败，请检查 surrealdb.log${NC}"
    cleanup
fi
echo -e "${GREEN}✓ 数据库已就绪 [Port: $DB_PORT]${NC}"

# 4. 启动 FastAPI 后端
echo -e "${YELLOW}⚡ 正在启动 FastAPI 后端 API (端口 $API_PORT)...${NC}"
$UV_CMD run --env-file .env run_api.py > api.log 2>&1 &

# 等待后端就绪
sleep 3
if ! nc -z 127.0.0.1 $API_PORT; then
    echo -e "${RED}❌ 后端 API 启动失败，请检查 api.log${NC}"
    cleanup
fi
echo -e "${GREEN}✓ 后端 API 已就绪 [Port: $API_PORT]${NC}"

# 5. 启动 Background Worker
echo -e "${YELLOW}⚡ 正在启动后台异步任务 Worker...${NC}"
PYTHONIOENCODING=utf-8 $UV_CMD run --env-file .env surreal-commands-worker --import-modules commands > worker.log 2>&1 &
echo -e "${GREEN}✓ 异步任务 Worker 已就绪${NC}"

# 6. 启动 Next.js 前端
echo -e "${CYAN}------------------------------------------------------${NC}"
echo -e "${GREEN}🎉 所有服务均已启动就绪！${NC}"
echo -e "${BLUE}👉 请在浏览器中打开: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${BLUE}👉 后端 API 文档地址: http://localhost:$API_PORT/docs${NC}"
echo -e "${YELLOW}💡 按下 [Ctrl+C] 可一键优雅地停止所有服务并清理后台进程。${NC}"
echo -e "${CYAN}------------------------------------------------------${NC}"
echo ""

cd frontend
if [ ! -x "node_modules/.bin/next" ]; then
    echo -e "${YELLOW}📦 首次启动：正在安装前端依赖...${NC}"
    npm ci
fi
npm run dev
