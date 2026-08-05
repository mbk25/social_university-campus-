# PostgreSQL'i durdurur.

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = "C:\Users\$env:USERNAME\kampus-pgdata"

if (-not (Test-Path "$dataDir\PG_VERSION")) {
    Write-Host "Veri dizini bulunamadi: $dataDir" -ForegroundColor Yellow
    exit 0
}

& "$pgBin\pg_ctl.exe" -D $dataDir -m fast stop
Write-Host "PostgreSQL durduruldu." -ForegroundColor Green
