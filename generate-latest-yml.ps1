param (
    [string]$ExePath = "dist\Bayan POS Setup 1.0.5.exe",
    [string]$Version = "1.0.5"
)

if (-not (Test-Path $ExePath)) {
    Write-Host "⚠️ File not found: $ExePath" -ForegroundColor Red
    Write-Host "Usage: .\generate-latest-yml.ps1 -ExePath 'dist\Bayan POS Setup 1.0.5.exe' -Version '1.0.5'" -ForegroundColor Yellow
    exit 1
}

$exeFile = Get-Item $ExePath
$fileName = $exeFile.Name

# حساب الـ SHA512 Base64 المطلوبة لملف latest.yml الخاصة بـ electron-updater
$bytes = [System.IO.File]::ReadAllBytes($ExePath)
$sha512Obj = [System.Security.Cryptography.SHA512]::Create()
$hashBytes = $sha512Obj.ComputeHash($bytes)
$base64Hash = [Convert]::ToBase64String($hashBytes)
$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$content = @"
version: $Version
files:
  - url: $fileName
    sha512: $base64Hash
    size: $($exeFile.Length)
path: $fileName
sha512: $base64Hash
releaseDate: '$date'
"@

$distDir = Split-Path -Parent $ExePath
if ([string]::IsNullOrEmpty($distDir)) { $distDir = "dist" }
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

$outputPath = Join-Path $distDir "latest.yml"
[System.IO.File]::WriteAllText($outputPath, $content, [System.Text.Encoding]::UTF8)

Write-Host "=========================================================" -ForegroundColor Green
Write-Host "✅ تم توليد ملف latest.yml بنجاح في: $outputPath" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host $content -ForegroundColor Cyan
