param(
    [Parameter(Mandatory=$true)]
    [string]$Target,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$Kit = Split-Path -Parent $MyInvocation.MyCommand.Path
$Template = Join-Path $Kit "template"

if (-not (Test-Path $Target -PathType Container)) {
    throw "Папка не найдена: $Target"
}

$Target = (Resolve-Path $Target).Path
$files = Get-ChildItem -Path $Template -Recurse -File

foreach ($file in $files) {
    $relative = $file.FullName.Substring($Template.Length).TrimStart('\','/')
    $destination = Join-Path $Target $relative
    $destinationDir = Split-Path -Parent $destination

    New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null

    if ((Test-Path $destination) -and -not $Force) {
        Write-Host "SKIP  $relative"
        continue
    }

    Copy-Item $file.FullName $destination -Force
    Write-Host "COPY  $relative"
}

Write-Host ""
Write-Host "Kairos QA Kit установлен: $Target"
Write-Host "Заполните .qa\PROJECT.md и запустите scripts\qa-doctor.sh через Git Bash/WSL."
