$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DemoRoot = Join-Path $ProjectRoot "demo_bundle"
$DatabaseSource = Join-Path $DemoRoot "surreal_data\mydatabase.db"
$DatabaseTarget = Join-Path $ProjectRoot "surreal_data\mydatabase.db"

if (-not (Test-Path $DatabaseSource -PathType Container)) {
    throw "缺少演示数据库模板：demo_bundle\surreal_data\mydatabase.db"
}

if (-not (Test-Path (Join-Path $DatabaseTarget "CURRENT") -PathType Leaf)) {
    Write-Host "首次启动：正在安装内置演示数据库..."
    New-Item -ItemType Directory -Force -Path $DatabaseTarget | Out-Null
    Copy-Item -Recurse -Force (Join-Path $DatabaseSource "*") $DatabaseTarget
}

$DemoData = Join-Path $DemoRoot "data"
if (Test-Path $DemoData -PathType Container) {
    Write-Host "正在校验内置演示媒体..."
    $DataTarget = Join-Path $ProjectRoot "data"
    New-Item -ItemType Directory -Force -Path $DataTarget | Out-Null
    Copy-Item -Recurse -Force (Join-Path $DemoData "*") $DataTarget
}

$EnvTarget = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $EnvTarget -PathType Leaf)) {
    Copy-Item (Join-Path $ProjectRoot ".env.demo.example") $EnvTarget
    Write-Host "已生成无密钥的本地演示配置 .env"
}

Write-Host "演示数据已就绪（4 个笔记本、16 个来源及配套学习资源）"
