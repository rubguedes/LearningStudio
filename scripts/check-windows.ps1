$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectCargo = Join-Path $projectRoot '.tools\cargo'
if (Test-Path -LiteralPath (Join-Path $projectCargo 'bin\cargo.exe')) {
    $env:CARGO_HOME = $projectCargo
    $env:RUSTUP_HOME = Join-Path $projectRoot '.tools\rustup'
    $env:PATH = (Join-Path $projectCargo 'bin') + ';' + $env:PATH
}
if ($env:OS -ne 'Windows_NT') { throw 'O alvo suportado é Windows.' }
$missing = @()
foreach ($tool in @('node', 'npm.cmd', 'cargo', 'rustc')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { $missing += $tool }
}
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$cpp = $null
if (Test-Path -LiteralPath $vswhere) {
    $cpp = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
if (-not $cpp) { $missing += 'Microsoft C++ Build Tools (Desktop development with C++) e Windows SDK' }
if ($missing.Count -gt 0) {
    Write-Output ('Pré-requisitos ausentes: ' + ($missing -join ', '))
    Write-Output 'Instruções oficiais: https://v2.tauri.app/start/prerequisites/#windows'
    exit 1
}
Write-Output 'Pré-requisitos básicos de compilação encontrados.'
& rustc --version
& cargo --version
& npm.cmd run tauri info
exit $LASTEXITCODE
