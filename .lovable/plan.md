
## Visão geral

Você perguntou 4 coisas — respondo cada uma como plano de evolução do Império HQ. Nada disso é trivial, então proponho **blocos independentes** que você pode aprovar separadamente.

---

## 1) Novas Skills que eu desenvolveria

Hoje você tem 17 skills (Avatar Architect, Devastador, Funnel Hacker, etc). Faltam skills que fecham a operação ponta-a-ponta:

**Criativos & Ads**
- **Creative Factory** — gera imagens de anúncio (Nano Banana Pro) com múltiplos ângulos do mesmo produto: "expert falando", "resultado antes/depois", "prova social", "objeção destruída", "curiosidade". Entrada: foto do expert + briefing. Saída: 10-20 variações prontas pro Meta Ads.
- **Ads Copy Multiplier** — dado 1 ângulo vencedor, gera 15 variações (headline/primary/description) pra teste A/B em escala.
- **Video Hook Generator** — gera 10 ganchos de abertura (3 seg) pra Reels/VSL com base em Avatar + produto. Já existe `roteiros-virais-reels` mas focado em estrutura; este foca só em **hook**.
- **Thumbnail Architect** — gera thumbnails pra YouTube/VSL com regra dos 3 elementos (rosto + texto + objeto).

**Vendas & Retenção**
- **Objection Destroyer** — dado o produto, lista as 20 objeções reais do avatar + script de quebra pra cada uma (pra WhatsApp, call, email).
- **Churn Predictor Skill** — analisa leads que compraram mas vão cancelar/pedir reembolso, gera sequência de retenção.
- **Upsell Matcher** — dado um cliente que comprou X, sugere o próximo produto da escada + copy personalizada.
- **DM Closer** — responde DMs de Instagram/WhatsApp no tom da marca, fechando venda ou qualificando.

**Inteligência**
- **Competitor Watchdog** — roda diário, pega anúncios novos dos concorrentes (via Facebook Ad Library), resume mudanças de ângulo.
- **Trend Hunter** — busca trending topics do nicho no Google Trends + TikTok, sugere conteúdos pra surfar.
- **Review Miner** — raspa reviews de produtos concorrentes (Hotmart, Amazon, Udemy), extrai dores/desejos reais em massa.

**Operação**
- **Daily Briefing Pro** — relatório diário às 8h com: vendas ontem, ads ruins, leads quentes parados, tarefas vencidas, 1 ação prioritária do dia.
- **WhatsApp Persona Clone** — aprende seu estilo de escrita no WhatsApp e responde leads como você.

---

## 2) Ajustes no sistema (o que mais apertar)

**Dashboard**
- **Modo "Comando Único"** — tela inicial com 1 número que importa hoje (ex: "faltam R$ 2.3k pra bater meta") + 3 ações recomendadas pela IA
- **Heatmap de horários** — quando suas vendas acontecem vs quando seus ads rodam (descasamento = dinheiro perdido)
- **Comparativo semana vs semana** em todo KPI (hoje só tem mês)

**Leads & CRM**
- **Auto-follow-up** — lead parado há X dias → IA dispara mensagem personalizada com base no histórico
- **Lead scoring visual** — coluna "temperatura" (🔥 quente / 🌡️ morno / 🧊 frio) na tabela
- **Fusão de leads duplicados** — mesmo email/telefone vira 1 registro com timeline unificada

**Ads**
- **Botão "pausar automaticamente"** — regra: se CPA > X por 3 dias → pausa sozinho
- **Sugestão de realocação de budget** — IA diz "tira R$ 50 do adset A e coloca no B"
- **Diff de criativos** — compara top vs bottom e explica o porquê (cor, texto, rosto, gancho)

**WhatsApp**
- **Tags automáticas** de conversa (dúvida, objeção, quente, frio) via IA
- **Resumo de conversa** — botão que resume thread de 50 msgs em 3 bullets
- **Resposta sugerida inline** — IA sugere 3 respostas abaixo do input

**Financeiro**
- **Fluxo de caixa projetado** (60/90 dias) com sazonalidade
- **Alerta de queima de caixa** — "se o ROAS continuar assim, quebra em X dias"

---

## 3) Mais métricas / controle / autonomia

**Métricas que faltam**
- **LTV por canal de aquisição** (Instagram orgânico vs Ads vs Indicação)
- **Tempo médio lead → venda** (velocidade do funil)
- **Taxa de resposta do WhatsApp** por horário/dia
- **ROI por conteúdo** (quanto cada Reels gerou em vendas — via UTM ou pixel)
- **Cohort de retenção** — % de alunos que chegam ao módulo X
- **Saturação de audiência** (frequency vs CPA)
- **Share of voice** — % de anúncios seus vs concorrentes no nicho

**Controle**
- **Modo read-only** pra freelancers (ver sem editar)
- **Aprovação em 2 passos** pra disparos massa > 500 pessoas
- **Rate limit por usuário** (pra não estourar cota de IA)
- **Audit log global** — quem fez o quê, quando, onde (reverter com 1 clique)
- **Backups automáticos** de projetos (export JSON semanal)

**Autonomia (a IA age sozinha)**
- **Agentes autônomos 24/7** — rodam em cron, executam playbook: "todo dia 9h verifique ads, pause os ruins, me mande resumo"
- **Auto-resposta de leads por horário** — fora do expediente, IA responde e qualifica
- **Auto-criação de campanhas WhatsApp** — nova venda aprovada → dispara sequência de onboarding sem você tocar
- **Auto-segmentação** — leads são etiquetados automaticamente conforme comportamento

---

## 4) "Quero rodar um ads, ele cria imagens e vídeos"

Esse é o pedido mais concreto. Proponho **Creative Factory** como módulo novo:

**Fluxo de uso**
```text
┌─ /criativos (nova rota)
│
├─ 1. Briefing
│    - Seleciona projeto (puxa Avatar + Produto + Branding)
│    - Cola 2-3 fotos do expert (base pra variações)
│    - Cola URL de 1-3 anúncios de referência (scrape via Firecrawl)
│    - Escolhe ângulos (check-list: Dor, Desejo, Prova, Autoridade, Curiosidade, Antes/Depois)
│
├─ 2. IA gera (Nano Banana Pro — gemini-3-pro-image-preview)
│    - Variação por ângulo × cor de fundo × enquadramento
│    - Ex: 6 ângulos × 3 fundos = 18 imagens
│    - Cada imagem com texto overlay (headline curta gerada pela skill Ads Copy Multiplier)
│
├─ 3. Review & Edit
│    - Galeria tipo Midjourney (grid)
│    - Editar imagem: "mude o fundo pra azul", "tira o texto" — edição via Nano Banana edit
│    - Favoritar / reprovar
│
├─ 4. Export & Upload
│    - Download zip ou upload direto na biblioteca do projeto (imphq_midias)
│    - Pronto pra Meta Ads (especifico 1080×1080, 1080×1350, 1080×1920)
```

**Arquitetura técnica**
- Nova tabela `imphq_creative_batches` (id, project_id, briefing_json, referencias_urls[], status, created_at)
- Nova tabela `imphq_creative_assets` (id, batch_id, prompt_usado, angulo, image_url, aprovado, headline_copy)
- Bucket `creative-assets` no Supabase Storage
- Edge Function `creative-factory` que:
  - recebe briefing
  - chama Firecrawl pra scraping das referências
  - monta prompts por ângulo (usa skill nova **Creative Factory** como system prompt)
  - chama Nano Banana Pro em loop (com rate limit 1/seg)
  - salva cada imagem gerada no bucket + tabela
  - retorna batch_id pra UI fazer polling
- Edge Function `creative-edit` pra edições pontuais (pega imagem existente + instrução → Nano Banana edit)
- Páginas: `/criativos` (list), `/criativos/:batchId` (galeria), `/criativos/novo` (wizard)

**Para vídeos** (fase 2): integrar com Kling/Runway/Veo 3 via API — mas custo alto, sugiro começar só com imagem estática primeiro.

**Custo estimado**: ~$0.04/imagem Nano Banana Pro × 20 imagens/batch = $0.80 por geração. Se você gerar 5 batches/dia = $4/dia = $120/mês.

---

## Decisão

São 4 frentes grandes. Pra não virar um PR monstro, sugiro priorizar assim:

1. **Creative Factory (imagens)** — resposta direta ao pedido explícito
2. **Skills novas de Ads** (Copy Multiplier + Hook Generator + Objection Destroyer)
3. **Auto-follow-up de leads + tags automáticas WhatsApp**
4. **Dashboard "Comando Único" + métricas LTV/cohort**

Me diz qual bloco quer primeiro que eu faço um plano detalhado só dele.
