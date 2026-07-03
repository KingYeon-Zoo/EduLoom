#!/bin/bash

# Configuration
DB_DIR="./surreal_data"
API_PORT=5055
DB_PORT=8000
FRONTEND_PORT=3000

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "========================================="
    echo "🛑 正在停止所有 Open Notebook 本地服务..."
    echo "========================================="
    
    # Kill background jobs of this shell
    kill $(jobs -p) 2>/dev/null
    
    # Double check and kill any remaining processes
    pkill -f "surreal start.*rocksdb:$DB_DIR" 2>/dev/null
    pkill -f "run_api.py" 2>/dev/null
    pkill -f "surreal-commands-worker" 2>/dev/null
    pkill -f "next-dev" 2>/dev/null
    
    echo "✅ 所有服务已停止。"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "========================================="
echo "🚀 正在启动 Open Notebook 开发服务 (源码本地运行)..."
echo "========================================="

# 1. 确保 uv 存在
if ! command -v uv &> /dev/null && [ ! -f "$HOME/.local/bin/uv" ]; then
    echo "❌ 找不到 uv 包管理器，请先运行安装或配置 PATH。"
    exit 1
fi

UV_CMD="uv"
if [ -f "$HOME/.local/bin/uv" ]; then
    UV_CMD="$HOME/.local/bin/uv"
fi

# 2. 检查 SurrealDB 是否已安装
if ! command -v surreal &> /dev/null; then
    echo "❌ 找不到 surreal 命令，请确保已通过 Homebrew 安装 (brew install surrealdb/tap/surreal)。"
    exit 1
fi

# 3. 启动 SurrealDB
echo "📊 正在启动 SurrealDB 本地数据库 (端口 $DB_PORT)..."
mkdir -p "$DB_DIR"
surreal start --log info --user root --pass root --bind 127.0.0.1:$DB_PORT rocksdb:$DB_DIR/mydatabase.db > surrealdb.log 2>&1 &

# 等待数据库就绪
sleep 2
if ! nc -z 127.0.0.1 $DB_PORT; then
    echo "❌ 数据库启动失败，请检查 surrealdb.log"
    cleanup
fi
echo "✅ 数据库已启动。"

# 4. 启动 FastAPI 后端
echo "🔧 正在启动 FastAPI 后端 API (端口 $API_PORT)..."
$UV_CMD run --env-file .env run_api.py > api.log 2>&1 &

# 等待后端就绪
sleep 3
if ! nc -z 127.0.0.1 $API_PORT; then
    echo "❌ 后端 API 启动失败，请检查 api.log"
    cleanup
fi
echo "✅ 后端 API 已启动。"

# 5. 启动 Background Worker
echo "⚙️ 正在启动后台异步任务 Worker..."
$UV_CMD run --env-file .env surreal-commands-worker --import-modules commands > worker.log 2>&1 &
echo "✅ 异步任务 Worker 已启动。"

# 6. 启动 Next.js 前端
echo "🌐 正在启动 Next.js 前端 (端口 $FRONTEND_PORT)..."
echo "👉 请在浏览器中打开: http://localhost:$FRONTEND_PORT"
echo "按下 Ctrl+C 可一键停止所有服务并清理后台进程。"
echo "-----------------------------------------"

cd frontend && npm run dev
