

# Plano: Continuar tarefas pendentes + Scraping de site no Arsenal de Copy

## 1. Arsenal de Copy com scraping do site do produto

Hoje o botao "Gerar com IA" no `CopyArsenalSection` envia action `generate_copy_arsenal` para a edge function, que usa apenas o contexto do projeto (avatar, briefing, etc). **Nao le o site do produto.**

**Solucao**: Antes de chamar a IA, a edge function usa Firecrawl (ja configurado em `expert-research`) para fazer scrape dos links do produto. O conteudo scraped e injetado no prompt como contexto adicional.

### Mudancas

**`CopyArsenalSection.tsx`**: Passar `product_index` como `extraBody` para indicar qual produto gerar. Se houver mais de 1 produto, mostrar select para escolher.

**`supabase/functions/openflow-ai/index.ts`** — `handleCopyArsenal`:
- Receber `product_index` ou `product_name` do body
- Buscar `d.produtos[index].links` (array de URLs do produto)
- Chamar Firecrawl scrape em cada URL (max 2, formato markdown, truncado a 2000 chars cada)
- Injetar o conteudo scraped no system prompt antes de gerar o arsenal
- Fallback: se Firecrawl nao estiver configurado, gerar normalmente sem scraping

Logica:
```
// Dentro de handleCopyArsenal
const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
if (firecrawlKey && productLinks.length > 0) {
  for (const url of productLinks.slice(0, 2)) {
    const scraped = await fetch('https://api.firecrawl.dev/v1/scrape', { ... });
    scrapedContent += scraped.data.markdown.slice(0, 2000);
  }
  ctx += `\n## Conteudo do site do produto:\n${scrapedContent}\n`;
}
```

## 2. Mini-calendario no Painel Expert e Portal Publico (tarefa pendente)

**`ProjetoExpertPanel.tsx`**: Adicionar componente `Calendar` do shadcn acima das semanas. Dias com conteudo planejado recebem um dot colorido. Clicar num dia faz scroll para a semana correspondente.

**`ExpertPortal.tsx`**: Mesmo mini-calendario + adicionar `cross_platforms` badges e tipo "Video Longo" nos cards (sincronizar com o painel interno).

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/CopyArsenalSection.tsx` | Select de produto + passar product_index no extraBody |
| `supabase/functions/openflow-ai/index.ts` | handleCopyArsenal recebe product_index, scrape via Firecrawl, injetar conteudo no prompt |
| `src/components/projeto/ProjetoExpertPanel.tsx` | Mini-calendario com dots nos dias com conteudo |
| `src/pages/ExpertPortal.tsx` | Mini-calendario + cross_platforms + Video Longo |

## Ordem

1. Scraping + select de produto no Arsenal de Copy (edge function + frontend)
2. Mini-calendario no Painel Expert
3. Sincronizar ExpertPortal com melhorias visuais

