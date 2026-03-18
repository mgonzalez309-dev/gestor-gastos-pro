$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Matar instancias previas en los puertos 4500 y 5500 ──────────────────────
Write-Host "Liberando puertos..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 4500 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 5500 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# ── Backend (NestJS en puerto 4500) ──────────────────────────────────────────
Write-Host "Iniciando Backend en http://localhost:4500/api ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run start:dev:safe"

# Esperar a que el backend levante antes de abrir el browser
Write-Host "Esperando que el backend arranque..." -ForegroundColor Yellow
$maxWait = 30
$waited  = 0
do {
    Start-Sleep -Seconds 2
    $waited += 2
    $listening = Get-NetTCPConnection -LocalPort 4500 -State Listen -ErrorAction SilentlyContinue
} while (-not $listening -and $waited -lt $maxWait)

if ($listening) {
    Write-Host "Backend listo!" -ForegroundColor Green
} else {
    Write-Host "El backend tardó más de lo esperado, continuando igual..." -ForegroundColor Red
}

# ── Frontend (http-server en puerto 5500) ────────────────────────────────────
Write-Host "Iniciando Frontend en http://localhost:5500 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; powershell -NoProfile -ExecutionPolicy Bypass -File .\start-frontend-safe.ps1"

Start-Sleep -Seconds 3

# ── Abrir el navegador ───────────────────────────────────────────────────────
Write-Host "Abriendo el navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:5500/index.html"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  GastosApp corriendo!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5500/index.html" -ForegroundColor White
Write-Host "  Backend  : http://localhost:4500/api" -ForegroundColor White
Write-Host "  Swagger  : http://localhost:4500/docs" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green


