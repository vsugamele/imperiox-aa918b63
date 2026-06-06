# ============================================================
# upload-transcripts.ps1
# Envia as transcricoes de aulas do JP Freitas para a IA do ImperioHQ
# Executa: .\upload-transcripts.ps1
# ============================================================

$PROJECT_ID   = "jp_freitas"
$SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co"
$FOLDER       = "C:\Users\vsuga\Documents\Transcricoes_Aulas"
$FUNCTION_URL = "$SUPABASE_URL/functions/v1/transcript-ingest"

# Chave anon publica - funciona pois a funcao esta em modo --no-verify-jwt
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0"

# Arquivos a enviar - apenas os kb_*.txt (cursos individuais)
# Ordenados do menor para o maior para testar rapido antes dos arquivos gigantes
$files = Get-ChildItem -Path $FOLDER -Filter "kb_*.txt" | Sort-Object Length

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ImperioHQ - Upload de Transcricoes do JP Freitas" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Projeto  : $PROJECT_ID"
Write-Host "  Arquivos : $($files.Count) arquivos kb_*.txt"
Write-Host "  Destino  : $FUNCTION_URL"
Write-Host ""

$total   = $files.Count
$success = 0
$failed  = 0
$skipped = 0

for ($i = 0; $i -lt $files.Count; $i++) {
    $file    = $files[$i]
    $title   = $file.BaseName -replace "^kb_", "" -replace "_", " "
    $pct     = [int](($i / $total) * 100)
    $sizeStr = [math]::Round($file.Length / 1024, 0).ToString() + " KB"

    Write-Host ("[$($i+1)/$total] ($pct%) $title  ($sizeStr)") -NoNewline

    try {
        # Cast to [string] para evitar bug do PSObject no ConvertTo-Json
        $content = [string](Get-Content -Path $file.FullName -Raw -Encoding UTF8)
        if ([string]::IsNullOrWhiteSpace($content)) {
            Write-Host " -> VAZIO, pulado" -ForegroundColor Yellow
            $skipped++
            continue
        }

        $body = @{
            project_id = $PROJECT_ID
            title      = $title
            content    = $content
            source_tag = "transcript:$($file.BaseName)"
        } | ConvertTo-Json -Depth 2

        $response = Invoke-RestMethod `
            -Uri $FUNCTION_URL `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $SERVICE_KEY"
                "Content-Type"  = "application/json"
            } `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
            -TimeoutSec 300

        if ($response.success) {
            Write-Host (" -> OK " + $response.chunks + "/" + $response.total + " chunks") -ForegroundColor Green
            $success++
        } else {
            Write-Host (" -> ERRO: " + $response.error) -ForegroundColor Red
            $failed++
        }
    } catch {
        $errMsg = $_.Exception.Message
        if ($errMsg.Length -gt 80) { $errMsg = $errMsg.Substring(0, 80) }
        Write-Host (" -> FALHA: " + $errMsg) -ForegroundColor Red
        $failed++
    }

    # Pausa entre arquivos para nao sobrecarregar a API
    if ($i -lt ($files.Count - 1)) { Start-Sleep -Milliseconds 300 }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  CONCLUIDO" -ForegroundColor Cyan
Write-Host "  OK Sucesso : $success" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "  ERRO Falha : $failed" -ForegroundColor Red
} else {
    Write-Host "  ERRO Falha : $failed" -ForegroundColor Gray
}
Write-Host "  Pulados    : $skipped" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Base de conhecimento do JP Freitas atualizada!" -ForegroundColor Cyan
Write-Host "A IA agora conhece os ensinamentos dos cursos."  -ForegroundColor White
