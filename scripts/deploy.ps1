<#
.SYNOPSIS
    FlagForge 部署脚本（Docker Compose）
.DESCRIPTION
    构建镜像并启动所有服务（后端 + Web 管理后台）。
.PARAMETER Down
    停止并移除所有容器
.PARAMETER Build
    强制重新构建镜像
.PARAMETER Logs
    查看服务日志
#>
param(
    [switch]$Down,
    [switch]$Build,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ComposeFile = Join-Path $ProjectRoot "deploy\docker-compose.yml"

Write-Host "=== FlagForge Deploy ===" -ForegroundColor Yellow

# 检查 Docker
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "[!] 未找到 Docker，请先安装 Docker Desktop" -ForegroundColor Red
    Write-Host "    https://www.docker.com/products/docker-desktop/" -ForegroundColor Gray
    exit 1
}

# 停止
if ($Down) {
    Write-Host "[→] 停止所有服务..." -ForegroundColor Cyan
    docker compose -f $ComposeFile down
    Write-Host "[✓] 服务已停止" -ForegroundColor Green
    exit 0
}

# 查看日志
if ($Logs) {
    docker compose -f $ComposeFile logs -f --tail 50
    exit 0
}

# 构建 & 启动
$buildArg = if ($Build) { "--build" } else { "" }

Write-Host "[i] Compose 文件: $ComposeFile" -ForegroundColor Gray
Write-Host "[→] 构建并启动服务..." -ForegroundColor Cyan

if ($Build) {
    docker compose -f $ComposeFile up -d --build
} else {
    docker compose -f $ComposeFile up -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] 部署失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[✓] 部署成功！" -ForegroundColor Green
Write-Host ""
Write-Host "  后端 API:    http://localhost:8080" -ForegroundColor White
Write-Host "  Web 管理后台: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  查看日志: .\scripts\deploy.ps1 -Logs" -ForegroundColor Gray
Write-Host "  停止服务: .\scripts\deploy.ps1 -Down" -ForegroundColor Gray
Write-Host "  重新构建: .\scripts\deploy.ps1 -Build" -ForegroundColor Gray
