$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Matar instancias previas en los puertos 3000, 4500, 5555 ─────────────────
Write-Host "Liberando puertos..." -ForegroundColor Yellow
foreach ($port in @(3000, 4500, 5555)) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
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

# ── Frontend (Node/Express en puerto 3000) ───────────────────────────────────
Write-Host "Iniciando Frontend en http://localhost:3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; node server.js"

Start-Sleep -Seconds 2

# ── Prisma Studio (puerto 5555) ───────────────────────────────────────────────
Write-Host "Iniciando Prisma Studio en http://localhost:5555 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npx prisma studio"

Start-Sleep -Seconds 2

# ── Abrir el navegador ───────────────────────────────────────────────────────
Write-Host "Abriendo el navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:3000/landing"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  GastosApp corriendo!" -ForegroundColor Green
Write-Host "  Frontend      : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend       : http://localhost:4500/api" -ForegroundColor White
Write-Host "  Swagger       : http://localhost:4500/docs" -ForegroundColor White
Write-Host "  Prisma Studio : http://localhost:5555" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green


