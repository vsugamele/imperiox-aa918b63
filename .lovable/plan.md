

# Plano: Melhorar Configuracao CAPI + Guia de Setup por Projeto

## Resposta a duvida: Sim, funciona por projeto

O CAPI ja esta 100% organizado por projeto. Cada projeto tem seus proprios campos:
- `facebook_pixel_id`, `facebook_access_token`, `facebook_test_event_code` no JSONB `data`
- O webhook usa `?project={id}` para identificar o projeto e buscar os tokens CAPI daquele projeto especifico
- O script `imptrack.js` carrega o Pixel via `<meta name="imp-pixel-id">` na LP do projeto

Nada e compartilhado entre projetos. Tudo isolado.

---

## O que implementar

### 1. Melhorar UI de configuracao CAPI no ProjetoDetalhe (aba Analytics)

Hoje os 3 campos (Pixel ID, Access Token, Test Event Code) existem mas sem explicacao. Adicionar:

- **Texto de ajuda** abaixo de cada campo explicando o que e e onde encontrar
- **Link direto** para o Events Manager do Facebook (`https://business.facebook.com/events_manager2`)
- **Passo-a-passo colapsavel** com instrucoes visuais de como gerar o token CAPI
- **Botao "Testar CAPI"** que chama a edge function com `test_event_code` e mostra resultado
- **Status badge** mostrando se o ultimo envio CAPI foi bem-sucedido (pode ler de `imphq_webhooks`)

### 2. Adicionar secao CAPI no Guia da Plataforma

No `Guia.tsx`, adicionar uma nova secao "Configurar Facebook CAPI" com:
- Fluxo visual: `LP com imptrack.js → Captura lead → Webhook de venda → CAPI Purchase`
- Checklist: Pixel ID preenchido? Token CAPI preenchido? Webhook configurado?
- FAQ rapido: "Como gerar o token?", "Como testar?", "Preciso dos dois (Pixel + CAPI)?"

### 3. Melhorar explicacoes no dialog do Script (Tracker)

No dialog de script do Tracker (`showScript`), adicionar secao explicando a integracao com Facebook:
- Como o `<meta name="imp-pixel-id">` ativa o Pixel automaticamente
- Que o CAPI e enviado pelo servidor (webhook) e nao precisa de nada extra no front
- Que o `event_id` garante deduplicacao entre Pixel e CAPI

---

## Detalhes tecnicos

### ProjetoDetalhe.tsx (aba Analytics, card "Facebook Pixel & CAPI")
- Adicionar `<Collapsible>` com passo-a-passo de 5 etapas para gerar o token
- Textos de ajuda como `<p className="text-[10px] text-muted-foreground">` abaixo de cada Input
- Botao "Testar Evento" que faz fetch para a edge function webhook-pagamento com payload de teste

### Guia.tsx
- Nova secao "📘 Facebook CAPI" entre os modulos e os comandos, com cards de checklist e FAQ

### Tracker.tsx (dialog showScript)
- Adicionar bloco "Integracao com Facebook" no final do dialog, explicando Pixel + CAPI + dedup

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/pages/ProjetoDetalhe.tsx` | Adicionar textos de ajuda, passo-a-passo colapsavel, botao testar CAPI |
| `src/pages/Guia.tsx` | Nova secao CAPI com checklist e FAQ |
| `src/pages/Tracker.tsx` | Adicionar explicacao Facebook no dialog de script |

