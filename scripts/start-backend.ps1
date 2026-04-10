<#
.SYNOPSIS
    启动 FlagForge 后端服务（本地开发）
.DESCRIPTION
    自动检测端口占用，清理旧进程，启动 Go 后端。
.PARAMETER Clean
    启动前删除旧数据库文件
#>
param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$BackendDir = Join-Path $PSScriptRoot "..\backend"
$Port = 8080

Write-Host "=== FlagForge Backend ===" -ForegroundColor Yellow

# 检测端口占用
$existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
if ($existing) {
    Write-Host "[!] 端口 $Port 已被占用 (PID: $existing)，正在关闭..." -ForegroundColor Red
    $existing | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

# 清理旧 DB
if ($Clean) {
    $dbPath = Join-Path $BackendDir "flagforge.db"
    if (Test-Path $dbPath) {
        Remove-Item $dbPath -Force
        Write-Host "[✓] 已删除旧数据库" -ForegroundColor Green
    }
}

# 启动
Write-Host "[→] 启动后端: go run . (端口 $Port)" -ForegroundColor Cyan
Push-Location $BackendDir
try {
    go run .
} finally {
    Pop-Location
}
