$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
if ($PSVersionTable.PSEdition -eq 'Desktop') {
    Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
}
$officeMutex = [System.Threading.Mutex]::new($false, 'Local\ImperioHabblaudRelay')
if (-not $officeMutex.WaitOne(0)) { exit 0 }
try {
    $officeSecretFile = Join-Path $env:USERPROFILE '.habblaud/imperio/connection.dpapi'
    $officeSecure = (Get-Content -LiteralPath $officeSecretFile -Raw).Trim() | ConvertTo-SecureString
    $officePlain = [System.Net.NetworkCredential]::new('', $officeSecure).Password
    $officeNode = (Get-Command node -ErrorAction Stop).Source
    while ($true) {
        $officePlain | & $officeNode (Join-Path $PSScriptRoot 'relay.mjs')
        Start-Sleep -Seconds 10
    }
} finally { $officeMutex.ReleaseMutex(); $officeMutex.Dispose() }
