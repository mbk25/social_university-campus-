# PostgreSQL'i başlatır.
#
# Veritabanı Windows servisi olarak değil, kullanıcı klasöründeki bir veri
# dizininden çalışıyor. Bu yüzden bilgisayar yeniden başlatıldığında kendiliğinden
# açılmaz — bu betikle başlatılır.

$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = "C:\Users\$env:USERNAME\kampus-pgdata"
$logFile = Join-Path $dataDir "server.log"

if (-not (Test-Path "$pgBin\pg_ctl.exe")) {
    Write-Host "PostgreSQL bulunamadi: $pgBin" -ForegroundColor Red
    Write-Host "Kurulum icin: winget install PostgreSQL.PostgreSQL.17"
    exit 1
}

if (-not (Test-Path "$dataDir\PG_VERSION")) {
    Write-Host "Veri dizini bulunamadi: $dataDir" -ForegroundColor Red
    Write-Host "README'deki 'Veritabani kurulumu' adimlarini uygulayin."
    exit 1
}

$listening = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "PostgreSQL zaten calisiyor (5432)." -ForegroundColor Green
    exit 0
}

# pg_ctl'i ayrık süreç olarak başlat: doğrudan çağrılırsa konsol tutamacını
# bırakmadığı için PowerShell komut isteminde takılı kalır.
Start-Process -FilePath "$pgBin\pg_ctl.exe" `
    -ArgumentList @("-D", "`"$dataDir`"", "-l", "`"$logFile`"", "-o", "`"-p 5432`"", "start") `
    -WindowStyle Hidden

for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 700
    if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "PostgreSQL basladi (localhost:5432)." -ForegroundColor Green
        exit 0
    }
}

Write-Host "PostgreSQL baslatilamadi. Son gunluk satirlari:" -ForegroundColor Red
if (Test-Path $logFile) { Get-Content $logFile -Tail 15 }
exit 1
