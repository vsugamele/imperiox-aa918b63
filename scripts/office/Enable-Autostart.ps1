$ErrorActionPreference = 'Stop'
$officeStartup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Imperio-Escritorio.lnk'
$officePwsh = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
$officeScript = Join-Path $PSScriptRoot 'Start-Office.ps1'
$officeArguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $officeScript + '"'
$officeShell = New-Object -ComObject WScript.Shell
$officeShortcut = $officeShell.CreateShortcut($officeStartup)
if ((Test-Path -LiteralPath $officeStartup) -and $officeShortcut.Arguments -ne $officeArguments) {
    if (-not $officeShortcut.Arguments.Contains($officeScript)) { throw 'Atalho existente diferente: revise antes de substituir' }
    Copy-Item -LiteralPath $officeStartup -Destination (Join-Path $env:USERPROFILE ('.habblaud/imperio/shortcut-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.lnk'))
}
$officeShortcut.TargetPath = $officePwsh
$officeShortcut.Arguments = $officeArguments
$officeShortcut.WorkingDirectory = $PSScriptRoot
$officeShortcut.WindowStyle = 7
$officeShortcut.Description = 'Escritório do Império: Habblaud e conexão protegida'
$officeShortcut.Save()
Start-Process -FilePath $officePwsh -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"' + $officeScript + '"') -WindowStyle Hidden
Write-Output 'Escritório configurado para iniciar ao entrar no Windows.'
