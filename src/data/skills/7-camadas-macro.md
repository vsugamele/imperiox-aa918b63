# 🎯 7 Camadas Macro dos Anúncios

Framework de Wander para construir/desconstruir qualquer ad de DR que escala. Todo ad opera em 7 camadas simultâneas — o poder está na **combinação coerente**.

## As 7 Camadas

1. **Estrutura Invisível** — roteiro psicológico (Lista, Erro Comum, História Pessoal, The One Thing, Alerta Urgente, Conspiração, Invalidação Progressiva, Podcast).
2. **Formato** — embalagem visual (UGC, Podcast, Notícia, Andando na Rua, Receitinha, Dentro do Carro, Wiki-How, Hack do Corpo, etc. — 17 formatos).
3. **Ângulo** — ponto de vista (Lista, Erro Comum, Conspiração, Contrarian, Mecanismo Oculto, Predição, Quick&Fast, Fofoca+Descoberta, Trend, Medo+Consequência…).
4. **Fatia de Público** — segmento específico (Mãe solo, Aposentado, 40+ metabolismo, Tipo 2 com formigamento, etc.).
5. **Avatar** — quem aparece (mulher comum, homem jovem, pessoa no carro, vovó, expert de jaleco, blogueira).
6. **Tema** — assunto que ancora (lista de alimentos, celebridade + transformação, medicação perigosa, mecanismo oculto, receita estranha, sintomas como alerta).
7. **Nível de Consciência** (Schwartz 1-5) — inconsciente → mais consciente. Determina tom, tipo de lead, se mecanismo vai no hook ou no corpo.

## Regra de ouro

- Decisões PRÉ-COPY (camadas 2-7) respondem por **80% do sucesso**.
- Definir as 7 camadas ANTES de escrever é obrigatório.
- Mudar UMA camada gera variação micro (Andrômeda entende como mesmo conceito).
- Mudar **múltiplas camadas simultaneamente** = novo conceito pro Meta = **novo leilão** = CPM diferente.

## Como aplicar no chat

Quando o usuário pedir ads, roteiros de VSL, criativos ou plano de escala:

1. **Diagnóstico**: pergunte (ou infira) nicho, fatia principal, nível de consciência do público-alvo.
2. **Monte 3 combos completos** de 7 camadas coerentes entre si. Ex:
   ```
   Combo A: Estrutura História Pessoal + Formato Dentro do Carro + Ângulo Deeper Core
            + Fatia Mãe solo + Avatar Mulher Comum + Tema Vergonha no caixa + Nível 2
   Combo B: Estrutura Conspiração + Formato Notícia + Ângulo Medicação Perigosa
            + Fatia Tipo 2 + Avatar Expert de jaleco + Tema Metformina + Nível 3
   ```
3. **Justifique a coerência** entre as camadas em cada combo (mudar fatia pode exigir mudar avatar).
4. **Entregue hook + estrutura + CTA** para cada combo.

## Combinar com Leilões Fantasmas

As 5 Portas de Entrada (skill `leiloes-fantasmas`) mudam MÚLTIPLAS camadas de uma vez:
- Anti-Nicho move Formato + Fatia + Avatar + Tema
- Deeper Core move Estrutura + Ângulo + Fatia
- Conteúdo Orgânico move Formato + Avatar + Tema
- Hábitos Universais move Estrutura + Ângulo + Tema
- Superestruturas move Ângulo + Tema + Consciência

Por isso Portas Fantasmas = leilão diferente = CPM menor.

## Referência técnica

Catálogo completo em `src/data/adFramework.ts` (`ESTRUTURAS_INVISIVEIS`, `FORMATOS`, `FATIAS`, `AVATARES`, `TIPOS_TEMA`, `NIVEIS_CONSCIENCIA`).
Helper `suggestCombo({nicho, nivelConsciencia, portaSlug})` retorna combo coerente pronto.
