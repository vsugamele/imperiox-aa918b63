param()
$PROJECT_ID   = "jp_freitas"
$SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co"
$FOLDER       = "C:\Users\vsuga\Documents\Transcricoes_Aulas"
$FUNCTION_URL = $SUPABASE_URL + "/functions/v1/transcript-ingest"
$SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"
$CHUNK_CHARS  = 60000
$files = Get-ChildItem -Path $FOLDER -Filter "kb_*.txt" | Where-Object { $_.Length -gt 180000 } | Sort-Object Length
Write-Host "Arquivos grandes encontrados: $($files.Count)" -ForegroundColor Cyan
$ok = 0; $fail = 0
foreach ($file in $files) {
    $title = $file.BaseName -replace "^kb_", "" -replace "_", " "
    $size  = [math]::Round($file.Length/1024,0)
    Write-Host "Processando: $title ($size KB)" -ForegroundColor Yellow
    $fullContent = [string](Get-Content -Path $file.FullName -Raw -Encoding UTF8)
    if ([string]::IsNullOrWhiteSpace($fullContent)) { Write-Host "  VAZIO"; continue }
    $chunks = [System.Collections.Generic.List[string]]::new()
    $pos = 0
    while ($pos -lt $fullContent.Length) {
        $len = [Math]::Min($CHUNK_CHARS, $fullContent.Length - $pos)
        $chunks.Add($fullContent.Substring($pos, $len))
        $pos += $len
    }
    Write-Host "  $($chunks.Count) chunks" -ForegroundColor Gray
    $fileOk = $true
    for ($c = 0; $c -lt $chunks.Count; $c++) {
        $ct = if ($chunks.Count -gt 1) { $title + " pt" + ($c+1) } else { $title }
        $st = $file.BaseName + "_p" + ($c+1)
        $obj = [ordered]@{ project_id=$PROJECT_ID; title=$ct; content=[string]$chunks[$c]; source_tag="transcript:$st" }
        $bodyJson = $obj | ConvertTo-Json -Depth 2
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
        try {
            $r = Invoke-RestMethod -Uri $FUNCTION_URL -Method POST -Headers @{ "Authorization"="Bearer $SERVICE_KEY"; "Content-Type"="application/json" } -Body $bodyBytes -TimeoutSec 120
            if ($r.success) { Write-Host "    chunk $($c+1) OK $($r.chunks) emb" -ForegroundColor Green }
            else { Write-Host "    chunk $($c+1) ERRO: $($r.error)" -ForegroundColor Red; $fileOk=$false }
        } catch { Write-Host "    chunk $($c+1) FALHA: $($_.Exception.Message.Substring(0,[Math]::Min(80,$_.Exception.Message.Length)))" -ForegroundColor Red; $fileOk=$false }
        if ($c -lt ($chunks.Count-1)) { Start-Sleep -Milliseconds 600 }
    }
    if ($fileOk) { $ok++ } else { $fail++ }
    Start-Sleep -Seconds 1
}
Write-Host "PRONTO: $ok OK / $fail falhas" -ForegroundColor Cyan
