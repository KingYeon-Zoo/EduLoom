#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_ROOT="$PROJECT_ROOT/demo_bundle"
DATABASE_TARGET="$PROJECT_ROOT/surreal_data/mydatabase.db"

if [[ ! -d "$DEMO_ROOT/surreal_data/mydatabase.db" ]]; then
  echo "❌ 缺少演示数据库模板：demo_bundle/surreal_data/mydatabase.db"
  exit 1
fi

if [[ ! -f "$DATABASE_TARGET/CURRENT" ]]; then
  echo "📦 首次启动：正在安装内置演示数据库..."
  mkdir -p "$DATABASE_TARGET"
  cp -R "$DEMO_ROOT/surreal_data/mydatabase.db/." "$DATABASE_TARGET/"
fi

if [[ -d "$DEMO_ROOT/data" ]]; then
  echo "📦 正在校验内置演示媒体..."
  mkdir -p "$PROJECT_ROOT/data"
  cp -R "$DEMO_ROOT/data/." "$PROJECT_ROOT/data/"
fi

if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
  cp "$PROJECT_ROOT/.env.demo.example" "$PROJECT_ROOT/.env"
  echo "✓ 已生成无密钥的本地演示配置 .env"
fi

echo "✓ 演示数据已就绪（4 个笔记本、16 个来源及配套学习资源）"
