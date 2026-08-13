#!/usr/bin/env bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "======================================================"
echo " EduLoom · 学织  比赛演示版"
echo "======================================================"

./scripts/bootstrap-demo-data.sh

missing=()
command -v uv >/dev/null 2>&1 || missing+=("uv")
command -v surreal >/dev/null 2>&1 || missing+=("SurrealDB")
command -v node >/dev/null 2>&1 || missing+=("Node.js")
command -v npm >/dev/null 2>&1 || missing+=("npm")

if (( ${#missing[@]} > 0 )); then
  echo ""
  echo "❌ 缺少运行环境：${missing[*]}"
  echo "请打开《作品安装与启动说明.md》，按“首次安装”完成依赖安装。"
  read -r -p "按回车键关闭窗口..."
  exit 1
fi

echo "启动完成后将自动打开 http://localhost:3000"
(sleep 6; open "http://localhost:3000" >/dev/null 2>&1 || true) &
exec ./run-dev.sh
