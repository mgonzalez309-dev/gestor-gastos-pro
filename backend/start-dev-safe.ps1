$port = 4500
if ($env:PORT) {
    $port = [int]$env:PORT
}

Write-Host "Verificando puerto backend ($port)..." -ForegroundColor Yellow
$existing = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

if ($existing) {
    Write-Host "Puerto $port en uso por PID $existing. Finalizando proceso..." -ForegroundColor Yellow
    Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "Iniciando backend en puerto $port..." -ForegroundColor Cyan
npm run start:dev
