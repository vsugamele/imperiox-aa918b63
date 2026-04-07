

# Plano: Guia Tecnico do Hub Local + Deletar Sessoes Offline

## 1. Guia Tecnico embutido no Hub Local

Adicionar um componente colapsavel (Collapsible) dentro da aba Hub Local, logo abaixo do `WaHubQrPanel`, com um guia tecnico explicando:

- Arquitetura: command bus via Supabase (tabelas `wa_hub_iso_commands`, `wa_hub_iso_events`, `wa_hub_iso_sessions`)
- Fluxo: front insere comando `get_qr` → worker local poll → worker gera QR → grava evento `qr_status` → front poll e exibe
- Como rodar o worker local (endpoint esperado, polling de commands)
- Campos do payload: `qrImageUrl`, `qrText`, `qrAvailable`, `needsQr`, `hasSession`
- Reset: comando `reset_session` via command bus
- Troubleshooting: sessao travada, worker offline, QR nao aparece

Sera um componente `HubGuide.tsx` renderizado dentro da aba `hub` em `WhatsAppPage.tsx`.

## 2. Deletar sessoes offline

Na secao de badges de sessoes offline (linha 476-480 do `WhatsAppPage.tsx`), adicionar um botao "Limpar Offline" que:

- Busca todas as sessoes com status != `connected` da tabela `wa_hub_iso_sessions`
- Deleta essas sessoes + seus eventos e comandos associados
- Atualiza a lista local

Tambem adicionar um botao de delete individual (icone X) em cada badge de sessao offline.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/whatsapp/HubGuide.tsx` | Novo componente com guia tecnico colapsavel |
| `src/pages/WhatsAppPage.tsx` | Importar HubGuide + botao "Limpar Offline" + delete individual de sessoes |

## Ordem

1. Criar HubGuide.tsx com conteudo tecnico
2. Integrar no WhatsAppPage na aba hub
3. Adicionar logica de delete de sessoes offline (bulk + individual)

