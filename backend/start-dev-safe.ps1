$port = 4500
if ($env:PORT) {
    $port = [int]$env:PORT
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

$envFile = Join-Path $scriptRoot ".env"
$envExampleFile = Join-Path $scriptRoot ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExampleFile)) {
    Write-Host ".env no existe. Creando desde .env.example..." -ForegroundColor Yellow
    Copy-Item $envExampleFile $envFile
}

Write-Host "Verificando puerto backend ($port)..." -ForegroundColor Yellow
$existing = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

if ($existing) {
    Write-Host "Puerto $port en uso por PID $existing. Finalizando proceso..." -ForegroundColor Yellow
    Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    Write-Host "Levantando PostgreSQL con Docker Compose..." -ForegroundColor Cyan
    docker compose up -d db | Out-Null

    $maxTries = 30
    $ready = $false
    for ($i = 1; $i -le $maxTries; $i++) {
        $status = docker inspect -f "{{.State.Health.Status}}" gastosapp-postgres 2>$null
        if ($LASTEXITCODE -eq 0 -and $status -eq "healthy") {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if ($ready) {
        Write-Host "PostgreSQL listo. Aplicando migraciones..." -ForegroundColor Green
        npx prisma migrate deploy
    } else {
        Write-Host "PostgreSQL no quedó healthy a tiempo. Revisa: docker logs gastosapp-postgres" -ForegroundColor Red
    }
} else {
    Write-Host "Docker no encontrado. Asegurate de tener PostgreSQL local corriendo para DATABASE_URL." -ForegroundColor Yellow
}

Write-Host "Iniciando backend en puerto $port..." -ForegroundColor Cyan
npm run start:dev
