#!/bin/bash
# 启动本地开发环境（后端 + Web）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== FlagForge Dev Environment ==="

# 启动后端
echo "[→] 启动后端..."
cd "$PROJECT_ROOT/backend"
go run . &
BACKEND_PID=$!

# 等待后端就绪
echo "[i] 等待后端就绪 (port 8080)..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8080/admin/apps > /dev/null 2>&1; then
        echo "[✓] 后端已就绪"
        break
    fi
    sleep 0.5
done

# 启动前端
echo "[→] 启动 Web..."
cd "$PROJECT_ROOT/web"
if [ ! -d "node_modules" ]; then
    npm install
fi
npx vite --host &
WEB_PID=$!

echo ""
echo "[✓] 开发环境已启动"
echo "  后端:  http://localhost:8080"
echo "  前端:  http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
trap "kill $BACKEND_PID $WEB_PID 2>/dev/null; exit 0" INT TERM
wait
