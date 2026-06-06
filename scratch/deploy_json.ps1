$N8N_URL = "https://darkadvanced-n8n.llxtug.easypanel.host"
$API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNzY5MjNmMy1mNDcyLTQ2NWItOTg5NS00YTg0ZjUxOTQ2ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzgwNzAzMzQ3fQ.BpxzK9In4rj0tYsnK_vykQo6kok6G1N4sEJoLVLa9sY"

$Headers = @{
    "X-N8N-API-KEY" = $API_KEY
    "Content-Type"  = "application/json; charset=utf-8"
}

# IDs dos workflows criados anteriormente
$InboundId = "nOK8JlfDM0PqStPJ"
$OutboundId = "gzEALUENGopWLoxj"

Write-Host "Iniciando atualização dos workflows no n8n..."

# Update Inbound
$InboundJson = Get-Content -Raw -Path "scratch\inbound_workflow.json"
$InboundBytes = [System.Text.Encoding]::UTF8.GetBytes($InboundJson)

try {
    Write-Host "Atualizando workflow de entrada (ID: $InboundId)..."
    $Res1 = Invoke-RestMethod -Uri "$N8N_URL/api/v1/workflows/$InboundId" -Method Put -Headers $Headers -Body $InboundBytes
    Write-Host "Workflow de Entrada atualizado com sucesso!"
} catch {
    Write-Error "Falha ao atualizar workflow de Entrada: $_"
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Error "Erro detalhado: $($Reader.ReadToEnd())"
    }
}

# Update Outbound
$OutboundJson = Get-Content -Raw -Path "scratch\outbound_workflow.json"
$OutboundBytes = [System.Text.Encoding]::UTF8.GetBytes($OutboundJson)

try {
    Write-Host "Atualizando workflow de saída (ID: $OutboundId)..."
    $Res2 = Invoke-RestMethod -Uri "$N8N_URL/api/v1/workflows/$OutboundId" -Method Put -Headers $Headers -Body $OutboundBytes
    Write-Host "Workflow de Saída atualizado com sucesso!"
} catch {
    Write-Error "Falha ao atualizar workflow de Saída: $_"
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Error "Erro detalhado: $($Reader.ReadToEnd())"
    }
}

Write-Host "Processo de atualização concluído."
