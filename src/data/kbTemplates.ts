export interface KBSection {
  key: string;
  title: string;
  icon: string;
  description: string;
  defaultContent: string;
}

export const KB_SECTIONS: KBSection[] = [
  {
    key: "empresa",
    title: "A Empresa",
    icon: "🏛",
    description: "Missão, visão, valores e posicionamento",
    defaultContent: `# 🏛 Império Digital — A Empresa

## Missão
[Descreva a missão da empresa aqui]

## Visão
[Visão de longo prazo]

## Valores
- [Valor 1]
- [Valor 2]
- [Valor 3]

## Posicionamento
[Como a empresa se posiciona no mercado]

## História
[Contexto e background da empresa]`,
  },
  {
    key: "imperio_os",
    title: "Império OS — Guia",
    icon: "⚡",
    description: "Guia de operação do sistema",
    defaultContent: `# ⚡ Império OS — Guia de Operação

## O que é o Império OS
O Império OS é um sistema operacional para negócios digitais. Ele organiza projetos, avatares, agentes de IA, documentação e tarefas em uma interface unificada.

## Estrutura de Projetos
Cada projeto tem:
- **Briefing**: nome, produto, preço, objetivo, contexto, links
- **Avatar**: desejos externos/internos, dores superficiais/profundas, medos, objeções, inimigo, resultado sonhado, trigger event, sub-avatares, storyboard
- **Branding**: arquétipo, manifesto, mecanismo único, tom de voz, cores
- **KPIs**: thumbstop, CTR, CPM, CPC, ROAS, LTV, CAC, CVR
- **Pipeline**: % de conclusão por fase (avatar, funil, copy, prompts, design, tráfego)
- **Assets**: biblioteca de criativos, copies, landing pages
- **Docs**: documentação específica do projeto (SOPs, roteiros, guias)
- **Kanban**: tarefas ativas organizadas por board e status

## Hierarquia de Prioridade
1. Projetos com status "Vendendo" — manter e escalar
2. Projetos "Ativo" — acelerar pipeline
3. Projetos "Em Construção" — completar foundation
4. Projetos "Pausado" — reavaliar

## Fluxo de Execução
Projeto → Avatar completo → Branding → Copy → Criativos → Tráfego → Dados → Otimização

## Regras de Ouro para Agentes
1. Sempre leia o avatar completo antes de qualquer task de copy
2. Use o branding/tom de voz como filtro obrigatório
3. Consulte os SOPs do projeto antes de criar qualquer ativo
4. Documente outputs relevantes nos Docs do projeto
5. Atualize o Kanban após cada entrega`,
  },
  {
    key: "avatares_globais",
    title: "Avatares Globais",
    icon: "🧠",
    description: "Perfis de avatar por vertical",
    defaultContent: `# 🧠 Avatares Globais

## Fórmula Mágica de Avatar

### Desejo Externo (O que eles dizem que querem)
[O que o avatar declara publicamente como seu objetivo]

### Desejo Interno (O que eles realmente querem sentir)
[A emoção ou identidade por trás do desejo externo]

### Dores Superficiais
[Os problemas que eles descrevem quando perguntados]

### Dores Profundas
[As dores reais por baixo — vergonha, medo, frustração profunda]

### Inimigo Externo
[Quem ou o quê está entre eles e o resultado que querem]

### Resultado Sonhado
[A transformação completa — o "depois" da jornada]

### Trigger Event
[O que aconteceu que fez eles começarem a buscar solução agora]

## Perfis por Vertical

### iGaming
[Avatar específico do vertical iGaming]

### Lançamentos / Infoprodutos
[Avatar específico de compradores de infoprodutos]

### E-commerce / Nutraceuticals
[Avatar do comprador de produtos físicos]`,
  },
  {
    key: "agentes_squads",
    title: "Agentes & Squads",
    icon: "🤖",
    description: "Estrutura de agentes IA e squads",
    defaultContent: `# 🤖 Agentes & Squads

## 🧠 Squad Avatar
- **Pesquisador de Avatar**: mapeia dores, desejos, objeções via pesquisa
- **Psicólogo de Mercado**: identifica gatilhos emocionais profundos
- **Analista de Concorrentes**: analisa posicionamento e fraquezas da concorrência

## ✍️ Squad Copy
- **Copywriter VSL**: roteiros de vídeo de vendas
- **Email Specialist**: sequências de nutrição e lançamento
- **Ad Copywriter**: copy para anúncios Meta/Google/TikTok

## 🎨 Squad Criativo
- **Art Director**: direção visual e conceito criativo
- **Social Media Designer**: posts, stories, reels
- **Video Editor**: edição e produção de vídeo

## 📊 Squad Tráfego
- **Media Buyer**: gestão de campanhas pagas
- **Analytics Specialist**: análise de dados e otimização
- **Funnel Builder**: criação e otimização de funis

## 🚀 Squad Estratégia
- **Estrategista de Produto**: oferta, posicionamento, pricing
- **Launch Manager**: coordenação de lançamentos
- **Growth Hacker**: identificação de oportunidades de escala`,
  },
  {
    key: "frameworks_copy",
    title: "Frameworks de Copy",
    icon: "✍️",
    description: "VSL, emails, ads e estruturas de persuasão",
    defaultContent: `# ✍️ Frameworks de Copy

## VSL Structure (Video Sales Letter)
1. **Hook** — Interrupção e captura da atenção (0-15s)
2. **Problema** — Agitação da dor principal
3. **Identificação** — "Eu já fui onde você está"
4. **Sonho** — O resultado desejado
5. **Inimigo** — Quem ou o quê está bloqueando
6. **Descoberta** — O mecanismo único
7. **Prova** — Depoimentos, resultados, evidências
8. **Oferta** — O que está sendo vendido
9. **Bônus** — Stack de valor
10. **Garantia** — Eliminação de risco
11. **CTA** — Chamada para ação urgente

## Email de Vendas
- Subject line com curiosidade/benefício/urgência
- Abertura com história ou identificação
- Problema agitado
- Solução apresentada
- CTA claro

## Ad Copy (Meta)
- **Hook** (3s): interrupção visual + texto de impacto
- **Problema**: 1-2 frases
- **Solução**: o que você oferece
- **Prova social**: números ou depoimento
- **CTA**: ação específica`,
  },
  {
    key: "frameworks_lancamento",
    title: "Frameworks de Lançamento",
    icon: "🚀",
    description: "PLF, perpétuo, semente, webinar",
    defaultContent: `# 🚀 Frameworks de Lançamento

## PLF (Product Launch Formula) — Jeff Walker
1. **Pré-pré-lançamento**: despertar curiosidade
2. **Pré-lançamento**: 3 vídeos de conteúdo (problema, solução, transformação)
3. **Carrinho aberto**: 7 dias com urgência
4. **Recuperação**: sequência de emails para não-compradores

## Lançamento Perpétuo
- Funil evergreen com sequência de emails automática
- VSL principal + sequência de 7-21 emails
- Webinar gravado ou ao vivo semanal
- Retargeting contínuo

## Semente / Mini-lançamento
- Lista pequena (100-500 pessoas)
- Venda direta sem eventos
- Oferta exclusiva por tempo limitado

## Seminário / Webinar
- Convite → Pré-webinar → Ao vivo → Replay → Fechamento`,
  },
  {
    key: "frameworks_trafego",
    title: "Frameworks de Tráfego",
    icon: "📊",
    description: "Estrutura de campanhas e métricas",
    defaultContent: `# 📊 Frameworks de Tráfego

## Estrutura de Campanha Meta
Campanha (objetivo) → Conjunto (público + orçamento) → Anúncio (criativo + copy)

## Tipos de Público
- **TOF (Topo)**: interesses, lookalike 2-5%, amplo
- **MOF (Meio)**: engajamento, visualização de vídeo
- **BOF (Fundo)**: retargeting visitantes, abandonos

## Métricas de Referência
- Thumbstop rate: >30%
- CTR link: >1.5%
- CPM: depende do nicho
- ROAS mínimo: >2x (break-even), >3x (escala)

## Regra do Criativo
- Teste mínimo 3-5 ângulos diferentes
- Rotacione a cada 2-3 semanas
- Hook é responsável por 80% do resultado`,
  },
  {
    key: "sops",
    title: "SOPs Globais",
    icon: "📋",
    description: "Procedimentos operacionais padrão",
    defaultContent: `# 📋 SOPs Globais

## SOP-001: Briefing de Novo Projeto
1. Preencher todos os campos do briefing
2. Definir avatar primário com dores e desejos
3. Estabelecer branding básico (arquétipo, tom)
4. Definir objetivo de lançamento/escala
5. Criar primeiras tasks no Kanban

## SOP-002: Criação de Copy
1. Ler briefing completo do projeto
2. Ler avatar completo (dores, desejos, storyboard)
3. Verificar branding e tom de voz
4. Usar framework adequado ao formato
5. Entregar 2-3 variações
6. Documentar no Docs do projeto

## SOP-003: Análise de Resultados
1. Coletar dados das plataformas (Meta, Google, Hotmart)
2. Comparar com metas do KPI
3. Identificar top performers e underperformers
4. Propor otimizações
5. Documentar insights nos Docs do projeto`,
  },
  {
    key: "persona_ias",
    title: "Persona das IAs",
    icon: "🎭",
    description: "Tom de voz e personalidade dos agentes",
    defaultContent: `# 🎭 Persona das IAs

## Instrução Global para Todas as IAs
Você opera dentro do sistema Império HQ. Todo output deve ser orientado a conversão e resultado mensurável. Não opine — execute. Quando não tiver informação suficiente, pergunte exatamente o que precisa.

## 🤖 Agente Generalista — Imperius
- **Tom**: Direto, estratégico, sem rodeios. Pensa como CEO experiente.
- **Nunca faz**: pedir desculpas, ser passivo, usar linguagem corporativa genérica
- **Sempre faz**: propor soluções, questionar premissas ruins, dar perspectiva de mercado

## ✍️ Agente de Copy — Copybot
- **Tom**: Persuasivo, empático, orientado ao avatar. Escreve como copywriter de resposta direta.
- **Referência de voz**: [Cole exemplos de copy que você aprova aqui]

## 🎨 Agente Criativo — ClawBot
- **Tom**: Visual-first, orientado a padrões de atenção no primeiro frame
- **Referência**: [Cole exemplos de criativos que performam aqui]`,
  },
  {
    key: "regras_comunicacao",
    title: "Regras de Comunicação",
    icon: "📣",
    description: "Tom de voz, palavras proibidas, por canal",
    defaultContent: `# 📣 Regras de Comunicação

## Tom de Voz Global
- **Linguagem**: Português brasileiro informal mas profissional
- **Energia**: Alta, positiva, sem ser forçado
- **Estilo**: Como um mentor que já passou pelo mesmo caminho

## Palavras PROIBIDAS
- "Solução inovadora" / "No mundo atual" / "Na era digital"
- Qualquer clichê de autoajuda vazio
- Jargão corporativo: "alavancar", "sinergia", "stakeholder"

## Por Canal

### Meta Ads
- Hook nos primeiros 3 segundos. Máximo 125 chars antes do "ver mais"

### WhatsApp / DM
- Tom conversacional. Mensagens curtas (3-4 linhas). Emojis com moderação ✅

### Email
- Subject: curiosidade ou urgência (máximo 50 chars). CTA único e claro.

### VSL
- Primeiro minuto: problema + identificação. Nunca revelar preço antes do valor.`,
  },
  {
    key: "objecoes",
    title: "Objeções & Respostas",
    icon: "🛡",
    description: "Framework de quebra de objeções",
    defaultContent: `# 🛡 Objeções & Respostas

## Framework (4 passos)
1. **Valide** ("Faz sentido você pensar isso")
2. **Reframe** ("A questão é que...")
3. **Prova** (caso, dado, depoimento)
4. **CTA** (próximo passo claro)

## Objeções Mais Comuns

### "É muito caro"
"Entendo. A pergunta real é: quanto está te custando NÃO resolver isso? Se [resultado] vale R$X pra você, o investimento se paga em [prazo]."

### "Não tenho tempo"
"Exatamente por isso esse método foi desenhado — [resultado] em [tempo mínimo]. Quem mais dizia isso hoje são os que mais agradecem."

### "Não sei se funciona pra mim"
"Olha o caso de [case], mesma situação que você: [resultado mensurável]."

### "Preciso pensar"
"O que especificamente está te fazendo hesitar? Geralmente tem uma dúvida específica que ainda não foi respondida."

### "Já tentei outras coisas"
"Me conta o que você tentou. [Ouvir]. O que diferencia é [mecanismo único] — é exatamente por isso que funciona onde outros falham."`,
  },
  {
    key: "scripts_venda",
    title: "Scripts de Venda",
    icon: "🗣",
    description: "Templates para WhatsApp, DM e fechamento",
    defaultContent: `# 🗣 Scripts de Venda

## WhatsApp — Primeiro Contato (Lead Quente)
Oi [Nome]! Vi que você se cadastrou sobre [produto].
Queria entender sua situação antes de explicar como funciona.
Me conta: qual é o maior desafio que você tem hoje com [problema]?

## WhatsApp — Fechamento
[Nome], entendi tudo.
Olhando sua situação, o [produto] resolve exatamente [dor específica que ele disse].
Temos [X] vagas essa semana. Fechando hoje, você garante [bônus/condição].
Como prefere pagar — cartão ou PIX?

## DM Instagram — Abordagem Fria
Ei [Nome]! Vi seu perfil e percebi que você [observação específica].
Tenho trabalhado com pessoas no mesmo momento que você — ajudei [resultado].
Vale um papo de 5 minutos pra ver se faz sentido pra você?`,
  },
  {
    key: "aprendizados",
    title: "Histórico de Aprendizados",
    icon: "💡",
    description: "O que funcionou, o que não funcionou, benchmarks",
    defaultContent: `# 💡 Histórico de Aprendizados

## ✅ O que FUNCIONOU

### [Data] — [Campanha/Ação]
- **O que foi feito**: [Descreva]
- **Resultado**: [Métricas]
- **Por que funcionou**: [Análise]
- **Replicar em**: [Próximas oportunidades]

## ❌ O que NÃO funcionou

### [Data] — [Campanha/Ação]
- **O que foi tentado**: [Descreva]
- **Resultado**: [Métricas]
- **Por que falhou**: [Análise]

## 🧪 Hipóteses para Testar
- [ ] [Hipótese 1]
- [ ] [Hipótese 2]

## 📊 Benchmarks do Negócio
- Thumbstop rate médio: [%]
- CTR médio: [%] | CPL médio: R$[X]
- Taxa de conversão: [%] | LTV médio: R$[X]`,
  },
];
