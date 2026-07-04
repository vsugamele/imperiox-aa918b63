
# Próximas evoluções do Mapa da Empresa

Escolhi 6 frentes de alto impacto, ordenadas por ROI. Você aprova as que quiser — implemento só as marcadas.

## 1. KPIs vivos em cada nó (receita, leads, conversão)
Hoje só `oferta` mostra KPIs. Estender para:
- **checkout**: taxa de conversão (vendas / sessões) + receita 7d
- **upsell/downsell/orderbump**: take-rate (%) e receita incremental
- **vsl/pagina_vendas**: view→lead e lead→venda
- **anuncio**: CPA, ROAS, CTR (puxando de `imphq_ads_daily`)
- **whatsapp**: mensagens 24h + hot leads ativos
Badge colorido no canto do card (verde/amarelo/vermelho) segundo meta.

## 2. Conexões automáticas inteligentes
Hoje `autopopulateFromProject` cria nós mas conecta tudo na raiz. Melhorar:
- Traçar o **caminho canônico**: Anúncio → Captura → VSL → Página → Checkout → Orderbump → Upsell → Downsell
- Vincular WhatsApp aos nós de Checkout e Captura (recuperação)
- Vincular sequência de e-mail à Captura
- Edges tracejadas para "recuperação", sólidas para "fluxo principal"

## 3. Painel Gaps 2.0 — contextual e acionável
Além dos gaps atuais:
- Detectar **nós órfãos** (sem conexão)
- Detectar **VSL sem página de vendas depois**
- Detectar **checkout sem orderbump/upsell**
- Detectar **anúncio sem UTM configurado** (cruzar com `imphq_ads`)
- Cada gap com botão "Corrigir agora" que já cria o nó **e conecta** no lugar certo

## 4. Modo apresentação / foco
- Botão "Apresentar": fullscreen, esconde controles, aumenta fontes
- Filtro por camada: só Aquisição / só Conversão / só Retenção
- Highlight de caminho: clicar num nó destaca upstream+downstream, escurece o resto

## 5. Snapshot e versionamento do mapa
- Botão "Salvar versão" cria snapshot em `imphq_company_map_snapshots`
- Comparar versões (o que mudou entre semana passada e hoje)
- Útil para review de crescimento com equipe

## 6. Templates estratégicos prontos
Adicionar em `mapTemplates.ts`:
- **Lançamento Interno** (captura → aulas → CPL → carrinho aberto/fechado → upsell)
- **Perpétuo VSL** (ads → VSL → checkout → order/up/down → nurture)
- **Webinar automático** (ads → inscrição → live → replay → pitch → checkout)
- **High-ticket** (ads → VSL → aplicação → call → proposta)

---

## Fora de escopo desta rodada
- Colaboração em tempo real (multi-cursor)
- Export para Miro/Figma
- IA gerando mapa a partir de descrição em texto

## Recomendação
Se quiser máximo impacto rápido: **1 + 2 + 3**. É o que transforma o mapa de "diagrama bonito" em "cockpit operacional".

Quais frentes aprovo?
