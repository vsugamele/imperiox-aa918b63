# Story UX1.2 — Fábrica de criativos: o fluxo guiado numa tela

**Status:** Done · **Data:** 2026-10-15 · Fase 2 da reorganização (parte 1)

## Contexto
O caminho de um criativo estava espalhado em Studio (Elenco), Estratégias (Mineração) e Testes (Leva, artes, placar).
A Fábrica junta tudo por projeto e diz qual é o próximo passo.

## Critérios de aceite
- [x] `src/lib/creative-flow.ts`: 6 passos (Elenco → Mercado → Leva → Artes → Teste no ar → Placar e molde) com estado (feito/atenção/pendente), resumo e próximo passo; testado
- [x] `useFactoryStatus`: contagens do projeto (elenco com foto e persona, referências classificadas e fontes, levas por status, testes no ar, vencedores e moldes)
- [x] Página `/fabrica` usando o projeto do seletor global: os 6 passos clicáveis, faixa "Próximo passo" e os painéis de Elenco, Mineração e Leva embutidos; testes e placar continuam em /testes
- [x] Menu: "Fábrica (passo a passo)" no grupo Criativos; "Testes e levas" virou "Testes e placar"
- [x] Testes: `creative-flow.test.ts`, `fabrica-page.test.tsx`

## Adiado
Abas de Criativos dentro da página do projeto: `ProjetoDetalhe.tsx` está com trabalho em andamento de outra sessão.

## File List
- src/lib/creative-flow.ts, src/hooks/useFactoryStatus.ts, src/pages/Fabrica.tsx
- src/App.tsx, src/lib/navigation.ts, src/components/AppLayout.tsx
- src/test/creative-flow.test.ts, src/test/fabrica-page.test.tsx, src/test/navigation.test.tsx
