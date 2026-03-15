

# Plano: OpenFlow — Editor Visual de Fluxo + Geração de Narrativa com IA

## Visão

Quando o usuário clica em uma automação para editar, além do dialog atual (que é um formulário simples), ele terá acesso a um **editor visual de fluxo** estilo pipeline vertical, onde cada nó é uma ação (Trigger → Mensagem → Aguardar → Mensagem → ...). Além disso, um botão "Gerar com IA" puxa dados do projeto (avatar, produtos, funil) e gera a narrativa/copy de cada etapa automaticamente via Lovable AI Gateway.

## Alterações

### 1. Novo componente: `src/components/openflow/FlowEditor.tsx`

Editor visual de fluxo vertical com nós conectados por linhas SVG:

```text
  ┌──────────────┐
  │  🛒 Trigger   │  (Carrinho Abandonado)
  └──────┬───────┘
         │
  ┌──────┴───────┐
  │  ✉️ Email     │  "Oi {{nome}}, esqueceu algo?"
  └──────┬───────┘
         │
  ┌──────┴───────┐
  │  ⏱ Aguardar  │  30 min
  └──────┬───────┘
         │
  ┌──────┴───────┐
  │  💬 WhatsApp  │  "Ainda dá tempo..."
  └──────┬───────┘
         │
       [+ Nó]
```

- Cada nó é um card arrastável (reordenável) com tipo (email/whatsapp/telegram/aguardar) e conteúdo editável inline
- Novo tipo de ação: `aguardar` (delay puro, sem canal)
- Botão `[+ Nó]` entre cada nó e no final para inserir nova ação
- Linhas conectoras SVG entre nós (simples verticais com animação pulse)
- O trigger aparece como primeiro nó fixo (não removível)

### 2. Atualizar `src/pages/OpenFlow.tsx` — Dialog de edição

Substituir o dialog de edição atual pelo `FlowEditor` em tela cheia (ou dialog `max-w-2xl`):
- Manter compatibilidade: as ações continuam salvas no mesmo formato `Acao[]` em `imphq_automacoes.acoes`
- Adicionar tipo `aguardar` ao `ACAO_TIPOS`
- Botão "🤖 Gerar Narrativa com IA" no topo do editor

### 3. Nova edge function: `supabase/functions/openflow-ai/index.ts`

Usa Lovable AI Gateway (`LOVABLE_API_KEY` já disponível) para gerar a sequência de mensagens:

- Recebe: `project_id`, `trigger_tipo`, `num_etapas`
- Busca do Supabase: dados do projeto (`imphq_projects`), avatar/briefing do projeto (`data` JSONB), produtos associados (`imphq_vendas` agrupado por `produto_nome`), etapas do funil se existir
- Monta system prompt especializado em copy de automações (sequências de recuperação, boas-vindas, pós-venda)
- Retorna array de ações sugeridas com template preenchido
- Modelo: `google/gemini-3-flash-preview`
- Streaming não é necessário aqui — resposta JSON direta via `supabase.functions.invoke()`

### 4. Atualizar `supabase/config.toml`

Adicionar entry para a nova function:
```toml
[functions.openflow-ai]
verify_jwt = false
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/openflow/FlowEditor.tsx` | **Novo** — Editor visual de fluxo com nós verticais, SVG connectors, drag-to-reorder |
| `src/pages/OpenFlow.tsx` | Atualizar dialog de edição para usar FlowEditor, adicionar tipo `aguardar`, botão IA |
| `supabase/functions/openflow-ai/index.ts` | **Novo** — Edge function que gera narrativa de automação via Lovable AI |
| `supabase/config.toml` | Adicionar config da nova function |

