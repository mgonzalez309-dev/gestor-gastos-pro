$port = 5500
if ($env:FRONTEND_PORT) {
    $port = [int]$env:FRONTEND_PORT
}

Write-Host "Verificando puerto frontend ($port)..." -ForegroundColor Yellow
$existing = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

if ($existing) {
    Write-Host "Puerto $port en uso por PID $existing. Finalizando proceso..." -ForegroundColor Yellow
    Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "Iniciando frontend en puerto $port..." -ForegroundColor Cyan
npx http-server . -p $port --cors -c-1
