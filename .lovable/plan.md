# Sidebar + Header — Linguagem Editorial Híbrida

Sem os .jsx do mockup, sigo pela linguagem já consolidada no `/dashboard` (Cormorant itálico + DM Sans uppercase tracking-wide + hairlines em ouro). Escopo só visual/UX — sem mexer em rotas, dados ou comportamento.

## Sidebar (`AppSidebar.tsx`)

**Brand block (topo)**
- Substituir `Crown + "Imperio HQ"` por marca editorial:
  - Linha 1 (kicker): `IMPERIO` em DM Sans 9px tracking [0.32em] ouro
  - Linha 2 (wordmark): `HQ` em Cormorant Garamond itálico 28px
  - Hairline gold abaixo (mesmo `editorial-divider` do hero)
- Collapsed: só coroa monocromática centralizada com glow sutil

**Group labels**
- Renomear/estilizar como kickers: `· Operar`, `· Vender`, `· Inteligência`, `· Planejar`, `· Configurar`
- DM Sans 9px, tracking [0.28em], cor `gold/55`, ponto à esquerda

**Itens de menu**
- Remover cores chamativas por grupo (emerald/violet/cyan/amber) — manter ícone neutro `muted-foreground`, ativo vira ouro
- Ativo: trocar `border-r-2 border-primary + bg-primary/10` por:
  - Barra vertical à esquerda de 2px em ouro com glow (`box-shadow`)
  - Texto em ouro, peso 500
  - Fundo `transparent` (sem bloco preenchido)
- Hover: fundo `gold/5`, ícone vira `gold/70`
- Tipografia: DM Sans 13px, tracking levemente positivo

**Footer**
- Sair: ícone discreto + label em uppercase tracking-wide, sem cor destructive permanente — só no hover

**Separadores entre grupos**
- Hairline (`bg-border/40`) com pequeno respiro vertical, em vez de só margin

## Header (`AppLayout.tsx`)

**Altura e textura**
- Subir de `h-12` para `h-14` para acomodar dupla linha (timestamp + busca) ou manter `h-12` com itens mais finos
- Fundo `bg-background/70 backdrop-blur-xl` + hairline ouro inferior (em vez de `border-b border-border`)

**Estrutura nova (esquerda → direita)**
- `SidebarTrigger` minimalista (ícone fino, cor `muted/60`)
- Divisor vertical hairline
- Breadcrumb editorial: kicker da seção atual em DM Sans uppercase + título Cormorant itálico pequeno (derivado da rota)
- `GlobalSearch` recomposta: pill arredondada, fundo `secondary/30`, placeholder em itálico (`"Buscar no Império…"`), atalho `⌘K` em mono
- À direita: `ActionInbox`, `PushOptIn`, `NotificationBell` — todos como ícones outline 16px com badge ponto-ouro em vez de círculo preenchido

**Microdetalhes**
- Espaçamento `gap-3` entre clusters, `gap-1` dentro de cluster de ícones
- Tooltips em todos os ícones do header (DM Sans 10px uppercase)

## Tokens novos em `index.css`

Adicionar utilitários para reuso:
- `.brand-wordmark` — Cormorant itálico grande
- `.nav-kicker` — DM Sans 9px tracking 0.28em ouro/55
- `.nav-item-active` — barra vertical 2px gold + glow
- `.header-hairline` — gradient ouro fino (já temos `editorial-divider`, posso reaproveitar)

## Fora de escopo

- Rotas, ordem dos itens, agrupamento lógico (mantém Operar/Vender/Inteligência/Planejar/Configurar)
- `GlobalSearch` lógica interna (só wrapper visual)
- `ActionInbox`, `NotificationBell`, `PushOptIn` comportamento (só ícone/badge)
- Mobile drawer da sidebar (Shadcn já trata)
- Páginas além de chrome

## Arquivos a editar

- `src/components/AppSidebar.tsx`
- `src/components/AppLayout.tsx`
- `src/components/GlobalSearch.tsx` (só shell visual)
- `src/index.css` (utilitários)

Posso seguir?
