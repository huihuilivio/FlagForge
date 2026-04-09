#!/bin/bash
# 启动本地开发环境
set -e

echo "Starting FlagForge development environment..."
docker compose -f deploy/docker-compose.yml up --build
