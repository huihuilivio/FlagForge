<#
.SYNOPSIS
    启动 FlagForge Web 管理后台（本地开发）
.DESCRIPTION
    自动安装依赖，启动 Vite dev server。API 请求自动代理到 :8080。
#>

$ErrorActionPreference = "Stop"
$WebDir = Join-Path $PSScriptRoot "..\web"
$Port = 3000

Write-Host "=== FlagForge Web Admin ===" -ForegroundColor Yellow

# 确保 Node.js 可用
$nodePath = "C:\Program Files\nodejs"
if ((Test-Path $nodePath) -and ($env:Path -notmatch [regex]::Escape($nodePath))) {
    $env:Path = "$nodePath;$env:Path"
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "[!] 未找到 npm，请先安装 Node.js (>= 20)" -ForegroundColor Red
    Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor Gray
    exit 1
}

Write-Host "[i] Node $(node --version), npm $(npm --version)" -ForegroundColor Gray

# 检测端口占用
$existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
if ($existing) {
    Write-Host "[!] 端口 $Port 已被占用 (PID: $existing)，正在关闭..." -ForegroundColor Red
    $existing | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

Push-Location $WebDir
try {
    # 安装依赖
    if (-not (Test-Path "node_modules")) {
        Write-Host "[→] 安装依赖: npm install" -ForegroundColor Cyan
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }

    # 启动 dev server
    Write-Host "[→] 启动 Vite dev server (端口 $Port)" -ForegroundColor Cyan
    Write-Host "[i] API 代理 → http://localhost:8080 (请确保后端已启动)" -ForegroundColor Gray
    npx vite --host
} finally {
    Pop-Location
}
