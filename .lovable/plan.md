## Sim — tem, mas tá escondido e fraco

UTMs já são salvas em `imphq_leads.data.utms` (captura) e em `imphq_events`/`imphq_clicks` (jornada). Hoje só aparecem como **badges minúsculas no rodapé da aba Dados** (text-[9px], truncadas em 30 chars). Difícil ler campanhas Meta tipo `criativo-x|123456|video-y`.

## Plano (3 melhorias, só frontend)

### 1. Card "🔗 Origem & UTMs" dedicado na aba Dados
Substitui as badges minúsculas por bloco estruturado:
- **Source / Medium / Campaign / Content / Term** em linhas separadas, mono font, legível
- Botão **copy** ao lado de cada valor (útil pra colar em planilha)
- Mostra também:
  - **UTM da captura** (`lead.data.utms`) — primeira vez que o lead chegou
  - **UTM da última venda** (`vendas[0].data.utms`) se houver — o que realmente converteu
  - **First click** (de `imphq_clicks` mais antigo) — origem real do tráfego
- Se UTM contém pipe (`|`), separa visualmente: `criativo-x` · `123456` · `video-y`
- Link clicável se `utm_source` for URL

### 2. Coluna "UTM Source" opcional na tabela de Leads
- Adicionar toggle no header pra mostrar/esconder coluna
- Mostra `utm_source / utm_campaign` truncado, com tooltip completo no hover
- Permite escanear origem sem abrir cada lead

### 3. Filtro por UTM na sidebar
Em `LeadsSidebar.tsx`, adicionar filtro:
- **utm_source** (dropdown com valores únicos da base)
- **utm_campaign** (busca por texto contains)

## Arquivos a editar
- `src/pages/Leads.tsx` — novo card de UTMs (substitui linha 593), colunas na tabela
- `src/components/leads/LeadsSidebar.tsx` — filtros novos
- `src/components/leads/LeadsTable.tsx` — coluna UTM opcional

**Sem mudanças de schema.** Tudo já tá no banco.

Manda **"toca"** que executo. Se quiser cortar (ex: só o card, sem coluna nem filtro), é só falar.