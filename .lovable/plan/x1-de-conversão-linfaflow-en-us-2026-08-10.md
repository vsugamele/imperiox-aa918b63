# X1 de Conversão — LinfaFlow (EN-US)

Funil 1:1 híbrido: script fixo em pontos previsíveis + IA intervindo onde a decisão do lead muda o rumo. Roda em **Messenger (Zernio)** e **Chat do site (Webchat)**, em **inglês americano**, para o avatar do brief (mulher 40+/65+, "seus exames estão normais, mas seu corpo não está drenando").

## O que entra no produto

### 1. Dois templates novos no OpenFlow
Adicionados em `src/components/openflow/flow-editor/templates.ts`, categoria nova `x1-conversao`, com `canal` sugerido:

- **LinfaFlow X1 — Messenger (Zernio)** — trigger `lead_novo`, entrada vinda do advertorial/ads.
- **LinfaFlow X1 — Webchat (site)** — mesma espinha, adaptada para quem chega no advertorial ou na página de shop/reviews.

Ambos usam apenas blocos já suportados: `whatsapp` (texto do canal), `audio`, `ia_message`, `wait_reply`, `aguardar`, `qualify_lead`, `adicionar_tag`, `notify_operator`, `stop_on_event`.

### 2. Arquitetura do X1 (7 estágios)

```text
1. HOOK (script)        "Was it the morning puffiness or the heavy legs?" → 2 opções
2. DIAGNÓSTICO (IA)     escuta a resposta, espelha o sintoma, 1 pergunta por vez
3. REFRAME (script+vídeo) "normal labs ≠ normal drainage" → VIDEO_1
4. MECANISMO (áudio)    ritual de 30s, 4 botânicos, por função → AUDIO_1
5. PROVA (imagem)       antes/depois + reviews da shop page → IMG_1, IMG_2
6. OBJEÇÃO (IA)         uma objeção por mensagem (preço, "já tentei", ceticismo, esperar)
7. FECHAMENTO (script)  link do advertorial/checkout + urgência + garantia 30d
   → follow-up 12h e 36h, para em compra_aprovada
```
Onde a IA entra: estágios 2 e 6 (mais um resgate opcional no follow-up). O resto é script para manter previsibilidade.

### 3. Placeholders de mídia dentro do fluxo
Cada asset entra como variável no passo, para você colar a URL depois de gerar:
`{{video_hook}}`, `{{video_mecanismo}}`, `{{audio_ritual}}`, `{{img_prova_1}}`, `{{img_prova_2}}`, `{{img_ingredientes}}`, `{{link_advertorial}}`, `{{link_checkout}}`.

### 4. Documento de briefs de mídia (para você gerar)
Arquivo em `/mnt/documents/linfaflow-x1-media-briefs.md`, entregue como artifact, com para cada asset:
- ID / placeholder correspondente
- estágio do funil e objetivo
- formato (9:16, duração, com/sem legenda)
- prompt pronto para colar no Studio (imagem/vídeo) ou roteiro pronto para TTS
- 3 vídeos, 3 imagens, 2 áudios (voz feminina 45+, tom confidente, sem hype)

Nada de geração automática agora — só o brief; você gera e cola as URLs.

### 5. Checklist de ativação
Bloco curto no documento com: marcar `canal` do fluxo, colar webhook do Zernio, colar `<script>` do webchat nos advertorials e na shop page, preencher os 8 placeholders.

## Detalhes técnicos
- Só edição de dados/UI: `templates.ts` ganha os dois templates e a categoria `x1-conversao` no tipo `FlowTemplate`; `TemplatePicker` já filtra por categoria/nome, sem mudança.
- Blocos de canal usam `tipo: "whatsapp"`; o `openflow-executor` já roteia para Messenger/Webchat quando a automação tem `canal` diferente de whatsapp (branch de canais alternativos).
- `qualify_lead` marca score 60 (diagnóstico) e 85 (pronto p/ fechamento); `notify_operator` avisa o comercial no estágio 6.
- Sem migração de banco e sem nova Edge Function.
- Copy em inglês, compliance de suplemento: linguagem de "support", sem promessa de cura, garantia 30 dias citada como no brief.
