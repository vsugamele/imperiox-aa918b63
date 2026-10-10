param([Parameter(Mandatory)][string]$DeviceId, [string]$HabblaudRoot = 'C:\Users\vsuga\habblaud')
$ErrorActionPreference = 'Stop'
$officeDir = Join-Path $env:USERPROFILE '.habblaud/imperio'
New-Item -ItemType Directory -Path $officeDir -Force | Out-Null
# Restrict the directory before creating any credential. DPAPI binds it to this Windows user.
$officeAccount = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $officeDir /inheritance:r /grant:r "${officeAccount}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível proteger a configuração' }
$officeSecretFile = Join-Path $officeDir 'connection.dpapi'
if (Test-Path -LiteralPath $officeSecretFile) { throw 'Conexão existente: preserve a credencial e revise antes de reinstalar' }
$officeBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($officeBytes)
$officeToken = [Convert]::ToHexString($officeBytes).ToLowerInvariant()
$officeHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([System.Text.Encoding]::UTF8.GetBytes($officeToken))).ToLowerInvariant()
$officeEnv = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../.env')
function Read-OfficeEnv([string]$name) {
    $officeLine = $officeEnv | Where-Object { $_ -match "^${name}=" } | Select-Object -First 1
    if (-not $officeLine) { throw "Configuração ausente: $name" }
    return ($officeLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
}
$officeConfig = @{
    deviceId = $DeviceId; token = $officeToken
    url = Read-OfficeEnv 'VITE_SUPABASE_URL'; anonKey = Read-OfficeEnv 'VITE_SUPABASE_PUBLISHABLE_KEY'
    habblaudRoot = $HabblaudRoot
    codexBin = Join-Path $env:APPDATA 'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'
}
($officeConfig | ConvertTo-Json -Compress | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString) | Set-Content -LiteralPath $officeSecretFile
Write-Output "DeviceId=$DeviceId TokenHash=$officeHash"
# Startup installed after server-side device registration and validation.
