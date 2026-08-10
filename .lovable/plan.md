# LinfaFlow X1 reforçado + Templates na tela do OpenFlow

Duas frentes: injetar a engenharia de venda do dossiê Mansão JP Freitas dentro do funil LinfaFlow X1 (em inglês), e deixar os templates X1 acessíveis direto da tela principal do OpenFlow.

## 1. O que sai do dossiê e entra no LinfaFlow

O dossiê é pt-BR e high ticket R$7k; o LinfaFlow é EN-US e ticket baixo. Então não se copia copy — copia-se **estrutura e técnica**:

| Do dossiê | Como entra no LinfaFlow X1 |
|---|---|
| 3 perfis de lead por nível de consciência | A IA de diagnóstico passa a classificar a lead em 3 tracks: *Skeptic* (problem-aware), *Tried-everything* (solution-aware), *Ready* (product-aware) e muda o ritmo conforme o track |
| SPIN (situação → problema → implicação → necessidade) | O estágio de diagnóstico ganha as 4 camadas explícitas, uma pergunta por mensagem, na ordem |
| Pain Amplification | Pergunta de implicação: "and if nothing changes in the next 12 months, how does that feel?" antes do reframe |
| Value Equation (Hormozi) | Cálculo de ROI concreto na objeção de preço: sessões de drenagem, meias de compressão e bomba pneumática vs 1 frasco/30 dias |
| Future Pacing | Passo novo antes do fechamento: projeta a manhã dela em 3 semanas, usando o sintoma que ela mesma citou |
| Trial Close 0-10 | Novo passo de leitura de temperatura: "on a scale of 0 to 10, how much sense does this make?" — a IA ramifica por nota (≤5 volta pra objeção, 6-8 responde o gap, 9-10 fecha) |
| NEPQ Negative Reverse | Usado no "preciso pensar" e no follow-up: tom de desistência elegante em vez de pressão |
| Social Proof Clustering | As provas passam a ser enviadas em sequência agrupada (3 mulheres, mesma situação) em vez de solta |
| Assumptive Close | Fechamento pressupõe decisão e oferece escolha (1 frasco vs pacote de 3) |
| Árvore de negociação com teto | Guardrail: a IA nunca inventa desconto nem cupom; só usa a garantia de 30 dias e o pacote maior como moeda de troca |
| Palavras proibidas | Lista de banned words injetada nos prompts da IA (cure, treat, detox, weight loss, miracle, guaranteed results, only today) |
| Follow-ups D+1 / D+3 / D+7 / D+30 | A régua de follow-up cresce de 2 toques para 4, cada um com ângulo diferente (garantia, custo da inércia, prova nova, reabertura com ângulo novo) |
| Red flags / desqualificação | A IA marca `lead_tags: desqualificado` e para a régua quando detecta caçador de desconto ou fora do perfil |

Resultado prático nos dois templates (`LinfaFlow X1 — Messenger` e `LinfaFlow X1 — Webchat`):

```text
1. HOOK
2. DIAGNÓSTICO SPIN + classificação de track (IA)
3. AMPLIFICAÇÃO DA IMPLICAÇÃO (IA)            ← novo
4. REFRAME + vídeo
5. MECANISMO em áudio
6. PROVA agrupada (3 provas em sequência)
7. TRIAL CLOSE 0-10 com ramificação (IA)      ← novo
8. FUTURE PACING personalizado                ← novo
9. OBJEÇÕES: 7 objeções com significado oculto + ROI (IA)
10. FECHAMENTO assumptivo
11. FOLLOW-UP D+1 / D+3 / D+7 / D+30 (D+30 com negative reverse)
```

O documento de briefs de mídia ganha 2 assets novos: um áudio de "custo da inércia" e uma imagem de comparação de custo (drenagem/meias/bomba vs frasco).

## 2. Templates X1 na tela principal do OpenFlow

Hoje os templates só aparecem dentro do editor de fluxo. Passa a existir um botão **Templates X1** ao lado de "Novo Fluxo X1" que:

- abre um diálogo com os templates da categoria `x1-conversao` (cards com emoji, nome, canal sugerido, nº de passos e prévia dos 3 primeiros blocos);
- pede o projeto e o canal (WhatsApp / Messenger / Chat do site);
- cria o fluxo já pronto no banco, com nome, trigger, ações e canal preenchidos, e abre o editor nele.

Continua funcionando o picker de dentro do editor — nada é removido.

## Detalhes técnicos

- `src/components/openflow/flow-editor/templates.ts`: reescreve as ações dos dois templates LinfaFlow com os estágios novos; os prompts de IA passam a carregar as banned words, a árvore de objeções e a regra de trial close. Só dados, sem mudança de tipos.
- Novo `src/components/openflow/X1TemplateLauncher.tsx`: diálogo de seleção + criação. Insere em `imphq_automacoes` com `nome`, `trigger_tipo`, `acoes`, `canal`, `projeto_id`, `ativo: false`, reaproveitando o mesmo shape de gravação já usado em `OpenFlow.tsx`.
- `src/pages/OpenFlow.tsx`: adiciona o botão na barra de ações e chama o refetch da lista após criar.
- Atualiza `/mnt/documents/linfaflow-x1-media-briefs-v2.md` com os 2 assets novos e os placeholders adicionais (`{{audio_inercia}}`, `{{img_custo_comparativo}}`).
- Sem migração de banco, sem Edge Function nova.
