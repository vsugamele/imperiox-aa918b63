

# Plano: Objetivo com multiplos bullets + Inspiracoes do DOCX no Painel Expert

## 1. Objetivo do Movimento — multiplos bullets

Hoje o campo "Objetivo do Movimento" e um unico `Input`. Trocar por um sistema de lista onde o usuario pode adicionar varios bullets (ex: "Aquecimento para lancamento", "Captacao via Low Ticket", "Construir autoridade no nicho").

**Mudanca**: Trocar o `Input` por uma lista editavel com botao "+ Adicionar". Cada bullet tem campo de texto + botao de remover. Salvar como `content_objectives: string[]` (com migracao do campo antigo `content_objective: string`).

## 2. Fases semanais inspiradas no DOCX

O documento mostra que cada semana tem uma **fase estrategica** (Sem 1: Atracao, Sem 2: Autoridade + Live, Sem 3: Objecoes, Sem 4: Lancamento). Adicionar campo de **nome/fase** para cada semana nas tabs (ex: "Semana 1 — Atracao").

**Mudanca**: Adicionar campo editavel `week_labels` ao `MonthlyPlan`. Exibir como subtitulo na tab de cada semana. A IA tambem deve gerar os nomes das fases.

## 3. Resumo semanal com KPIs do DOCX

O documento tem tabela de resumo por semana (posts/semana, plataformas ativas, foco estrategico, evento central). Adicionar mini-resumo no topo de cada semana.

**Mudanca**: Adicionar campo `week_summary` (objeto com posts_count, focus, event) por semana. Exibir como barra de info compacta acima dos dias.

## 4. Guia de producao no painel

O documento tem rotina semanal de producao (domingo gravar, terca subir YT, etc) e formatos por plataforma. Adicionar secao "Guia de Producao" com notas editaveis.

**Mudanca**: Usar o campo `expert_notes` existente, mas adicionar templates pre-populados pela IA baseados no DOCX (rotina semanal, formatos por plataforma).

## 5. Prompt da IA enriquecido

Atualizar o prompt de geracao de plano de conteudo na edge function para gerar:
- Fases por semana (nome + foco)
- Resumo semanal (KPIs esperados)
- Stories diarios detalhados (bastidor, caixinha, repost)
- Estrutura de lives/webinarios quando aplicavel
- `content_objectives` como lista no prompt

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoExpertPanel.tsx` | Campo de objetivos com multiplos bullets, labels de fase por semana, mini-resumo semanal |
| `src/pages/ExpertPortal.tsx` | Exibir multiplos objetivos + fases semanais |
| `supabase/functions/openflow-ai/index.ts` | Prompt enriquecido para gerar fases, resumos semanais, objetivos multiplos |

## Ordem

1. Trocar campo de objetivo por lista de bullets editavel
2. Adicionar labels de fase e resumo por semana
3. Atualizar prompt da IA para gerar estrutura mais rica
4. Sincronizar portal publico

