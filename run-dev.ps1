#!/usr/bin/env pwsh
# EduLoom Windows Development Startup Script
# UTF-8 Encoding

# Configuration
$DB_DIR = "./surreal_data"
$API_PORT = 5055
$DB_PORT = 8000
$FRONTEND_PORT = 3000

# Process tracking
$Processes = @()

# Log files
$LogFileSurreal = "surrealdb.log"
$LogFileApi = "api.log"
$LogFileWorker = "worker.log"

function Write-Status($Symbol, $Message) {
    Write-Host "$Symbol $Message"
}

function Test-Port($Port, $TimeoutSeconds = 10) {
    $MaxAttempts = $TimeoutSeconds * 2
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $TcpClient = New-Object System.Net.Sockets.TcpClient
            $Connect = $TcpClient.BeginConnect("127.0.0.1", $Port, $null, $null)
            $Wait = $Connect.AsyncWaitHandle.WaitOne(500, $false)
            if ($Wait -and $TcpClient.Connected) {
                $TcpClient.EndConnect($Connect)
                $TcpClient.Close()
                return $true
            }
            $TcpClient.Close()
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Stop-AllServices {
    Write-Host ""
    Write-Host "========================================="
    Write-Host "[STOP] Stopping all EduLoom services..."
    Write-Host "========================================="

    foreach ($Proc in $Processes) {
        if ($Proc -and !$Proc.HasExited) {
            try {
                Stop-Process -Id $Proc.Id -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }

    # Fallback: kill by process name
    Get-Process -Name "surreal" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "uv" -ErrorAction SilentlyContinue | Stop-Process -Force

    Write-Host "[OK] All services stopped."
}

# Ctrl+C handler
$Action = {
    Stop-AllServices
    exit 0
}
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action $Action | Out-Null

Write-Host "========================================="
Write-Host "[START] EduLoom Development Services (Windows)"
Write-Host "========================================="

# 1. Check uv
$UvCmd = $null
if (Get-Command uv -ErrorAction SilentlyContinue) {
    $UvCmd = "uv"
} elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
    $UvCmd = "$env:USERPROFILE\.local\bin\uv.exe"
} elseif (Test-Path "$env:USERPROFILE\.local\bin\uv") {
    $UvCmd = "$env:USERPROFILE\.local\bin\uv"
}

if (-not $UvCmd) {
    Write-Host "[ERROR] uv not found. Install from: https://astral.sh/uv"
    exit 1
}
Write-Status "[OK]" "uv ready: $UvCmd"

# 2. Check SurrealDB
if (-not (Get-Command surreal -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] surreal not found. Install: winget install SurrealDB.SurrealDB"
    exit 1
}
Write-Status "[OK]" "SurrealDB ready"

# 3. Check .env
if (-not (Test-Path ".env")) {
    Write-Host "[WARN] .env not found. Copy from .env.example first."
    Write-Host "       Run: copy .env.example .env"
    exit 1
}

# 4. Start SurrealDB
Write-Status "[DB]" "Starting SurrealDB on port $DB_PORT..."
if (-not (Test-Path $DB_DIR)) {
    New-Item -ItemType Directory -Force -Path $DB_DIR | Out-Null
}

"" | Out-File -FilePath $LogFileSurreal -Encoding utf8

$SurrealProc = Start-Process -FilePath "surreal" `
    -ArgumentList "start", "--log", "info", "--user", "root", "--pass", "root", "--bind", "127.0.0.1:$DB_PORT", "rocksdb:$DB_DIR/mydatabase.db" `
    -RedirectStandardOutput $LogFileSurreal `
    -PassThru -NoNewWindow

$Processes += $SurrealProc

if (-not (Test-Port $DB_PORT 15)) {
    Write-Host "[ERROR] SurrealDB failed to start. Check $LogFileSurreal"
    Stop-AllServices
    exit 1
}
Write-Status "[OK]" "SurrealDB started"

# 5. Start FastAPI
Write-Status "[API]" "Starting FastAPI backend on port $API_PORT..."
"" | Out-File -FilePath $LogFileApi -Encoding utf8

$ApiProc = Start-Process -FilePath $UvCmd `
    -ArgumentList "run", "--env-file", ".env", "run_api.py" `
    -RedirectStandardOutput $LogFileApi `
    -PassThru -NoNewWindow

$Processes += $ApiProc

if (-not (Test-Port $API_PORT 20)) {
    Write-Host "[ERROR] FastAPI failed to start. Check $LogFileApi"
    Stop-AllServices
    exit 1
}
Write-Status "[OK]" "FastAPI backend started"

# 6. Start Worker
Write-Status "[WORKER]" "Starting background async task worker..."
"" | Out-File -FilePath $LogFileWorker -Encoding utf8

$WorkerProc = Start-Process -FilePath $UvCmd `
    -ArgumentList "run", "--env-file", ".env", "surreal-commands-worker", "--import-modules", "commands" `
    -RedirectStandardOutput $LogFileWorker `
    -PassThru -NoNewWindow

$Processes += $WorkerProc
Write-Status "[OK]" "Async worker started"

# 7. Start Frontend
Write-Status "[WEB]" "Starting Next.js frontend on port $FRONTEND_PORT..."

Push-Location frontend
if (-not (Test-Path "node_modules")) {
    Write-Status "[INSTALL]" "Installing frontend dependencies..."
    npm install
}
Pop-Location

Write-Host "========================================="
Write-Host "[OK] All backend services started!"
Write-Host "========================================="
Write-Host "Frontend: http://localhost:$FRONTEND_PORT"
Write-Host "API Docs: http://localhost:$API_PORT/docs"
Write-Host "Logs: $LogFileSurreal, $LogFileApi, $LogFileWorker"
Write-Host "Press Ctrl+C to stop all services"
Write-Host ""

# Run frontend in foreground
Push-Location frontend
try {
    npm run dev
} finally {
    Pop-Location
    Stop-AllServices
}