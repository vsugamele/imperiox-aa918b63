

# Plano: Importar Dados do HTML de Avatar + Integrar Analytics

## Contexto

O HTML enviado e um "Sistema de Inteligencia de Avatar" completo com 4 modulos:
- **Avatar**: Dossie completo (filtro de demanda, sub-avatares, camadas da psique, cenas de voyerismo)
- **Copy**: Assets de copy (hooks, headlines, scripts, blocos de persuasao)
- **Problemas**: Ranking de 15 problemas com scores, matriz de copy, frases exatas do avatar
- **Desejos**: 10 desejos externos, 10 internos, 5 proibidos, gatilhos emocionais, fases de ativacao

## 1. Importar Dados do HTML para o Projeto

### Abordagem: Expandir a aba Avatar do Projeto

O componente `ProjetoAvatar.tsx` atual tem campos basicos (desejos, dores, medos, sub-avatares, storyboard). Vamos expandi-lo para suportar toda a estrutura do HTML, usando o JSONB `avatar` que ja existe na tabela `imphq_projects`.

**Nova estrutura do JSONB `avatar`:**
```
avatar: {
  // Existente (manter)
  desejo_externo, desejo_interno, dores_superficiais, dores_profundas,
  medos, objecoes, inimigo, resultado_sonhado, trigger_event,
  fase_consciencia, sub_avatares, storyboard,
  
  // NOVO - Filtro de Demanda
  filtro_demanda: { score_total, criterios: [{nome, score, evidencia}] },
  
  // NOVO - Camadas da Psique (C1-C4)
  camadas_psique: {
    c1_observaveis: string[],
    c2_conscientes: { desejos: string[], frustracoes: string[] },
    c3_subconscientes: { crencas: string[], medos_profundos: string[] },
    c4_trauma: { ferida_central, padrao, contradição }
  },
  
  // NOVO - Voyerismos / Cenas
  voyerismos: [{ nome, intensidade, situacao, sintoma_fisico, 
                 pensamento, comportamento, uso_copy }],
  
  // NOVO - Desejos expandidos
  desejos_externos: [{ rank, nome, score, scores_detalhados, justificativa }],
  desejos_internos: [{ rank, nome, score, justificativa }],
  desejos_proibidos: [{ rank, nome, score, justificativa }],
  
  // NOVO - Problemas rankados
  problemas: [{ rank, nome, scores: {dor, frequencia, comunicar, ...}, total }],
  
  // NOVO - Matriz de Copy
  matriz_copy: {
    headlines_choque: [{ problema, headline }],
    aberturas_empaticas: [{ problema, copy }],
    objecoes_antecipadas: [{ objecao, virada, copy }],
    argumentos_urgencia: [{ problema, copy }],
    garantia: [{ medo, copy }]
  },
  
  // NOVO - Frases Exatas
  frases_exatas: [{ codigo, frase, uso }],
  
  // NOVO - Gatilhos Emocionais
  gatilhos: [{ nome, categoria, intensidade, situacao, copy_sugerido }],
  
  // NOVO - Perfil Psicologico
  perfil_psicologico: { retrato, arquetipo, ferida_central, padrao, contradicao }
}
```

### Interface: Novas sub-abas dentro de Avatar

Vou reestruturar `ProjetoAvatar.tsx` com sub-abas internas:

| Sub-aba | Conteudo |
|---|---|
| Perfil | Perfil psicologico, arquetipo, ferida central |
| Desejos | Desejos externos/internos/proibidos com scores |
| Dores | Dores superficiais/profundas, medos, objecoes |
| Sub-Avatares | Lista de sub-avatares expandida (hook, crenca, asset) |
| Camadas | C1-C4 da psique |
| Voyerismos | Cenas de voyerismo com campos detalhados |
| Problemas | Ranking de problemas com scores multidimensionais |
| Copy Arsenal | Matriz de copy, headlines, frases exatas |
| Gatilhos | Gatilhos emocionais e fases de ativacao |

### Botao "Importar HTML"

Adicionar um botao na aba Avatar que permite colar ou fazer upload de um HTML no formato do sistema de avatar. Um parser no frontend extrai os dados do DOM e preenche o JSONB automaticamente.

## 2. Analytics -- Integracao com o Restante

**Estado atual**: A aba Analytics salva `clarity_id`, `ga_id` e Facebook CAPI no projeto, mas esses dados NAO sao usados em nenhum outro lugar do sistema.

**O que falta integrar**:

1. **Tracker (imptrack.js)**: O script de tracking deveria ler o `facebook_pixel_id` do projeto para disparar eventos do Pixel automaticamente
2. **Webhook de pagamento**: Quando recebe uma compra, deveria enviar evento de Purchase para o CAPI do Facebook usando o access_token do projeto
3. **Dashboard do projeto**: Deveria mostrar metricas do Clarity/GA se os IDs estiverem configurados (embed de iframe ou link direto)

### Implementacao da integracao:

- Na aba Analytics, adicionar links diretos para os dashboards (Clarity/GA) baseados nos IDs configurados
- No `imptrack.js`, adicionar logica para carregar o pixel do Facebook automaticamente se `pixel_id` estiver presente
- Na edge function `webhook-pagamento`, quando processar compra aprovada, disparar evento CAPI se o projeto tiver `facebook_access_token` configurado

## Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `src/components/projeto/ProjetoAvatar.tsx` | Reescrever com sub-abas e todos os novos campos |
| `src/components/projeto/avatar/AvatarImporter.tsx` | Novo: parser de HTML para extrair dados do avatar |
| `src/components/projeto/avatar/PerfilTab.tsx` | Novo: sub-aba de perfil psicologico |
| `src/components/projeto/avatar/DesejosTab.tsx` | Novo: desejos com scores |
| `src/components/projeto/avatar/VoyerismosTab.tsx` | Novo: cenas de voyerismo |
| `src/components/projeto/avatar/ProblemasTab.tsx` | Novo: ranking de problemas |
| `src/components/projeto/avatar/CopyArsenalTab.tsx` | Novo: matriz de copy e frases |
| `src/components/projeto/avatar/GatilhosTab.tsx` | Novo: gatilhos emocionais |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar links de dashboard na aba Analytics |
| `supabase/functions/webhook-pagamento/index.ts` | Integrar CAPI do Facebook ao processar compras |

Nenhuma migration necessaria -- tudo usa o JSONB `avatar` existente.

