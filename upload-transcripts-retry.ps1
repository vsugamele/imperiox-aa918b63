# ============================================================
# upload-transcripts-retry.ps1
# Reenvia apenas os arquivos que falharam (>200KB) em lotes menores
# Divide textos grandes em pedacos de 80KB antes de enviar
# ============================================================

$PROJECT_ID   = "jp_freitas"
$SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co"
$FOLDER       = "C:\Users\vsuga\Documents\Transcricoes_Aulas"
$FUNCTION_URL = "$SUPABASE_URL/functions/v1/transcript-ingest"
$SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"

# Chunk size: 60KB de texto por requisicao (bem abaixo do timeout)
$CHUNK_CHARS = 60000

# Apenas os que falharam (>180KB) — os menores ja subiram
$files = Get-ChildItem -Path $FOLDER -Filter "kb_*.txt" |
         Where-Object { $_.Length -gt 180000 } |
         Sort-Object Length

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Retry Upload — Arquivos Grandes em Chunks" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Arquivos  : $($files.Count) arquivos > 180KB"
Write-Host "  Chunk max : $($CHUNK_CHARS / 1000)KB por requisicao"
Write-Host ""

$totalSuccess = 0
$totalFailed  = 0

for ($i = 0; $i -lt $files.Count; $i++) {
    $file    = $files[$i]
    $title   = $file.BaseName -replace "^kb_", "" -replace "_", " "
    $sizeStr = [math]::Round($file.Length / 1024, 0).ToString() + " KB"
    $pct     = [int](($i / $files.Count) * 100)

    Write-Host ("[$($i+1)/$($files.Count)] (" + $pct + "pct) $title ($sizeStr)") -ForegroundColor Cyan

    try {
        $fullContent = [string](Get-Content -Path $file.FullName -Raw -Encoding UTF8)
        if ([string]::IsNullOrWhiteSpace($fullContent)) {
            Write-Host "  -> VAZIO, pulado" -ForegroundColor Yellow
            continue
        }

        # Divide em chunks de CHUNK_CHARS caracteres
        $chunks = @()
        $pos = 0
        $chunkNum = 1
        while ($pos -lt $fullContent.Length) {
            $len = [Math]::Min($CHUNK_CHARS, $fullContent.Length - $pos)
            $chunks += $fullContent.Substring($pos, $len)
            $pos += $len
            $chunkNum++
        }

        Write-Host "  Dividido em $($chunks.Count) chunks" -ForegroundColor Gray

        $fileSuccess = $true
        for ($c = 0; $c -lt $chunks.Count; $c++) {
            $chunkTitle = if ($chunks.Count -gt 1) { "$title (parte $($c+1)/$($chunks.Count))" } else { $title }
            $sourceTag  = "$($file.BaseName)_part$($c+1)"

            $body = @{
                project_id = $PROJECT_ID
                title      = $chunkTitle
                content    = [string]$chunks[$c]
                source_tag = "transcript:$sourceTag"
            } | ConvertTo-Json -Depth 2

            try {
                $response = Invoke-RestMethod `
                    -Uri $FUNCTION_URL `
                    -Method POST `
                    -Headers @{
                        "Authorization" = "Bearer $SERVICE_KEY"
                        "Content-Type"  = "application/json"
                    } `
                    -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
                    -TimeoutSec 120

                if ($response.success) {
                    Write-Host ("    Chunk " + ($c+1) + "/" + $chunks.Count + " -> OK (" + $response.chunks + " embeddings)") -ForegroundColor Green
                } else {
                    Write-Host ("    Chunk " + ($c+1) + "/" + $chunks.Count + " -> ERRO: " + $response.error) -ForegroundColor Red
                    $fileSuccess = $false
                }
            } catch {
                $errMsg = $_.Exception.Message
                if ($errMsg.Length -gt 100) { $errMsg = $errMsg.Substring(0, 100) }
                Write-Host ("    Chunk " + ($c+1) + "/" + $chunks.Count + " -> FALHA: $errMsg") -ForegroundColor Red
                $fileSuccess = $false
            }

            # Pausa entre chunks
            if ($c -lt ($chunks.Count - 1)) { Start-Sleep -Milliseconds 500 }
        }

        if ($fileSuccess) { $totalSuccess++ } else { $totalFailed++ }

    } catch {
        $errMsg = $_.Exception.Message
        if ($errMsg.Length -gt 100) { $errMsg = $errMsg.Substring(0, 100) }
        Write-Host "  ERRO ao ler arquivo: $errMsg" -ForegroundColor Red
        $totalFailed++
    }

    # Pausa entre arquivos
    if ($i -lt ($files.Count - 1)) { Start-Sleep -Seconds 1 }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  CONCLUIDO" -ForegroundColor Cyan
Write-Host "  OK Sucesso : $totalSuccess" -ForegroundColor Green
if ($totalFailed -gt 0) {
    Write-Host "  ERRO Falha : $totalFailed" -ForegroundColor Red
} else {
    Write-Host "  ERRO Falha : 0" -ForegroundColor Gray
}
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host '49 aulas do JP Freitas totalmente indexadas!' -ForegroundColor Green
