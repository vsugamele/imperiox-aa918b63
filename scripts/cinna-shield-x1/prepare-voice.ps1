param([ValidateRange(0,5)][int]$Index = 0)
$ErrorActionPreference = 'Stop'
$projectRef = 'tkbivipqiewkfnhktmqq'
$baseUrl = "https://$projectRef.supabase.co"
$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'voice-manifest.json') | ConvertFrom-Json
$clip = $manifest[$Index]
$outputDir = Join-Path $PSScriptRoot '../../docs/sessions/2026-09/csx17-media'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$keys = (npx supabase projects api-keys --project-ref $projectRef -o json) | ConvertFrom-Json
$serviceKey = ($keys | Where-Object name -EQ 'service_role').api_key
if (-not $serviceKey) { throw 'Project service credential unavailable in authenticated CLI.' }
try {
  $headers = @{ Authorization = "Bearer $serviceKey"; apikey = $serviceKey }
  $cacheKey = "cinna-csx17-$($clip.id)-v1"
  $body = @{ text = $clip.text; session_id = 'cinna-shield'; cache_key = $cacheKey } | ConvertTo-Json
  $result = Invoke-RestMethod -Uri "$baseUrl/functions/v1/linfaflow-care-voice" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 90
  if (-not $result.ok -or -not $result.audio_url) { throw "Voice generation unavailable: $($result.error)" }
  $localPath = Join-Path $outputDir "$($clip.id).mp3"
  Invoke-WebRequest -Uri $result.audio_url -OutFile $localPath | Out-Null
  if ((Get-Item -LiteralPath $localPath).Length -lt 1000) { throw 'Audio response is unexpectedly small.' }
  # Do not publish expiring signed URLs into a permanent flow. Copy only this final clip.
  $path = "cinna-shield/csx17/$($clip.id).mp3"
  $uploadHeaders = @{ Authorization = "Bearer $serviceKey"; apikey = $serviceKey; 'x-upsert' = 'false' }
  try {
    Invoke-RestMethod -Uri "$baseUrl/storage/v1/object/creative-assets/$path" -Method Post -Headers $uploadHeaders -ContentType 'audio/mpeg' -InFile $localPath | Out-Null
  } catch {
    if ([int]$_.Exception.Response.StatusCode -ne 409) { throw 'Audio upload failed; inspect object status without exposing credentials.' }
  }
  $url = "$baseUrl/storage/v1/object/public/creative-assets/$path"
  $head = Invoke-WebRequest -Uri $url -Method Head
  if ($head.StatusCode -ne 200) { throw 'Public media verification failed.' }
  @{ id=$clip.id; stage=$clip.stage; url=$url; text=$clip.text; provider='elevenlabs'; disclosure='Prerecorded audio · AI-generated voice'; bytes=(Get-Item -LiteralPath $localPath).Length } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputDir "$($clip.id).json") -Encoding utf8
  Write-Output "Audio $($clip.id): generated and public URL verified."
} finally { $serviceKey = $null; $keys = $null; $headers = $null; $uploadHeaders = $null }
