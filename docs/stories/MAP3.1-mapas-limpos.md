# MAP3.1 — Limpeza visual dos mapas

**Status:** Done · 07/10/2026

## Contexto
Vinicius: "esses mapas mentais parecem confusos". O Bookmap DotCom Secrets (279 cartões) e o $100M Leads (280) abriam como canvas de funil sobreposto.

## Acceptance Criteria
- [x] Mapa de conhecimento (20+ cartões, 80%+ documentos) abre em "📚 Lista": árvore recolhível por seção montada pelas ligações (origem = pai, ordem visual entre irmãos, ciclos cortados), busca que mantém os ancestrais, abrir/fechar tudo, "Ver no mapa" leva ao cartão no canvas. O Mapa 2D continua disponível.
- [x] Mapas de funil com mais de 40 etapas mostram no Mapa 2D o atalho "Organizar automaticamente" (a reorganização existente, que guarda uma cópia antes).
- [x] Funis abre direto no "Painel ao vivo" (as outras visões continuam nos botões e por `?view=`).

## File List
- src/lib/map-outline.ts
- src/components/funis/MapOutlineView.tsx
- src/components/funis/CompanyMapCanvas.tsx
- src/pages/Funis.tsx
- src/test/map-outline.test.tsx
