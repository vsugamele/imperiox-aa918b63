$N8N_URL = "https://darkadvanced-n8n.llxtug.easypanel.host"
$API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNzY5MjNmMy1mNDcyLTQ2NWItOTg5NS00YTg0ZjUxOTQ2ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzgwNzAzMzQ3fQ.BpxzK9In4rj0tYsnK_vykQo6kok6G1N4sEJoLVLa9sY"

$Headers = @{
    "X-N8N-API-KEY" = $API_KEY
    "Content-Type"  = "application/json"
}

# ==================== WORKFLOW 1: INBOUND ====================
$InboundWorkflow = @{
    name = "ImperioX - Instagram Inbound Webhook"
    nodes = @(
        @{
            parameters = @{
                updates = @("messages", "comments")
            }
            type = "n8n-nodes-base.instagramTrigger"
            typeVersion = 1
            position = @(100, 300)
            id = "instagram-trigger"
            name = "Instagram Trigger"
        },
        @{
            parameters = @{
                jsCode = @"
const item = `$input.item.json;
if (item.message) {
  return {
    object: "instagram",
    entry: [
      {
        id: item.recipient?.id || "",
        messaging: [ item ]
      }
    ]
  };
} else {
  return {
    object: "instagram",
    entry: [
      {
        id: item.instagram_business_account_id || "",
        changes: [
          {
            field: "comments",
            value: item
          }
        ]
      }
    ]
  };
}
"@
            }
            type = "n8n-nodes-base.code"
            typeVersion = 2
            position = @(300, 300)
            id = "reconstruct-meta-envelope"
            name = "Reconstruct Envelope"
        },
        @{
            parameters = @{
                method = "POST"
                url = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/instagram-webhook"
                sendBody = $true
                specifyBody = "json"
                jsonBody = "={{ JSON.stringify(`$json) }}"
                options = @{}
            }
            type = "n8n-nodes-base.httpRequest"
            typeVersion = 4.2
            position = @(500, 300)
            id = "http-request-supabase"
            name = "Forward to Supabase"
        }
    )
    connections = @{
        "Instagram Trigger" = @{
            main = @(
                @(
                    @{
                        node = "Reconstruct Envelope"
                        type = "main"
                        index = 0
                    }
                )
            )
        }
        "Reconstruct Envelope" = @{
            main = @(
                @(
                    @{
                        node = "Forward to Supabase"
                        type = "main"
                        index = 0
                    }
                )
            )
        }
    }
    settings = @{
        executionOrder = "v1"
    }
}

# ==================== WORKFLOW 2: OUTBOUND ====================
$OutboundWorkflow = @{
    name = "ImperioX - Instagram Outbound Send"
    nodes = @(
        @{
            parameters = @{
                httpMethod = "POST"
                path = "send-instagram-message"
                responseMode = "responseNode"
                options = @{}
            }
            type = "n8n-nodes-base.webhook"
            typeVersion = 1
            position = @(100, 300)
            id = "webhook-trigger"
            name = "Webhook"
        },
        @{
            parameters = @{
                method = "POST"
                url = "https://graph.facebook.com/v21.0/me/messages"
                authentication = "predefined"
                nodeCredentialType = "facebookPageApi"
                sendBody = $true
                specifyBody = "json"
                jsonBody = "={{ { recipient: `$json.body.comment_id ? { comment_id: `$json.body.comment_id } : { id: `$json.body.recipient_id }, message: { text: `$json.body.text || `$json.body.message } } }}"
                options = @{}
            }
            type = "n8n-nodes-base.httpRequest"
            typeVersion = 4.2
            position = @(350, 300)
            id = "meta-graph-api-send"
            name = "Send via Facebook Page API"
        },
        @{
            parameters = @{
                responseDataSource = "allConnections"
                options = @{}
            }
            type = "n8n-nodes-base.respondToWebhook"
            typeVersion = 1
            position = @(600, 300)
            id = "respond-to-webhook"
            name = "Respond to Webhook"
        }
    )
    connections = @{
        "Webhook" = @{
            main = @(
                @(
                    @{
                        node = "Send via Facebook Page API"
                        type = "main"
                        index = 0
                    }
                )
            )
        }
        "Send via Facebook Page API" = @{
            main = @(
                @(
                    @{
                        node = "Respond to Webhook"
                        type = "main"
                        index = 0
                    }
                )
            )
        }
    }
    settings = @{
        executionOrder = "v1"
    }
}

# ==================== DEPLOY PROCESS ====================

Write-Host "Iniciando deploy de workflows no n8n..."

# Deploy Inbound
$InboundBody = $InboundWorkflow | ConvertTo-Json -Depth 100 -Compress
# Convert to UTF-8 bytes to ensure correct characters
$InboundBytes = [System.Text.Encoding]::UTF8.GetBytes($InboundBody)

Write-Host "Criando workflow de entrada..."
try {
    $Res1 = Invoke-RestMethod -Uri "$N8N_URL/api/v1/workflows" -Method Post -Headers $Headers -Body $InboundBytes
    Write-Host "Workflow de Entrada criado com sucesso! ID: $($Res1.id)"
} catch {
    Write-Error "Falha ao criar workflow de Entrada: $_"
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Error "Erro detalhado: $($Reader.ReadToEnd())"
    }
}

# Deploy Outbound
$OutboundBody = $OutboundWorkflow | ConvertTo-Json -Depth 100 -Compress
$OutboundBytes = [System.Text.Encoding]::UTF8.GetBytes($OutboundBody)

Write-Host "Criando workflow de saída..."
try {
    $Res2 = Invoke-RestMethod -Uri "$N8N_URL/api/v1/workflows" -Method Post -Headers $Headers -Body $OutboundBytes
    Write-Host "Workflow de Saída criado com sucesso! ID: $($Res2.id)"
} catch {
    Write-Error "Falha ao criar workflow de Saída: $_"
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Error "Erro detalhado: $($Reader.ReadToEnd())"
    }
}

Write-Host "Processo concluído."
