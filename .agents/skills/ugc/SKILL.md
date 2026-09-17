---
name: ugc
description: Omni UGC Ad Factory — pipeline que transforma produto + foto de referência de ator em anúncio UGC talking-head 9:16 de ~20s (2 clips de 10s stitcheados). Use quando o usuário pedir "gerar UGC", "ad falado", "vídeo com ator", "/ugc", ou mencionar hooks/pattern-interrupt/CTA em formato Reels/TikTok/Shorts.
---

# Omni UGC Ad Factory

Pipeline "gate-driven" para gerar anúncios UGC realistas. Baseado em github.com/MegaTroll222/OMNI-UGC-AD-FACTORY.

## Filosofia central

A parte difícil **não é gerar um talking head** — é fazer o espectador acreditar. Cinco falhas típicas que este pipeline evita:

1. **Ator renderizado** (pele plástica, olhos vidrados) → precisa parecer capturado.
2. **Script tipo anúncio** ("Descubra a solução definitiva…") → precisa soar humano.
3. **Voz monótona TTS** → precisa ter respiração, pausas, hesitação.
4. **Micro-comportamentos genéricos** → precisa de tique específico ancorado ao beat.
5. **Seam visível entre clips** → clip 2 deve ser semeado com o último frame do clip 1.

## O grande insight: gates com JSON

**Você nunca escreve prompt de geração à mão.** Você escreve JSON estruturado, o código valida contra glossários e MONTA o prompt no PASS. Prompt que pulou o gate não existe.

Glossários que o gate consulta:
- **Fisiologia por idade** — 18-25 / 26-35 / 36-45 / 46-60 / 60+ (poros, textura, elasticidade, cabelo).
- **32 micro-behaviors** — piscar assimétrico, olhar caído, expiração pelo nariz, tique de canto de boca, deglutição, mordida de lábio, cabeça inclinando, sobrancelha subindo unilateral etc.
- **6 categorias de voz** — respiração, pausas irregulares, filler words ("é…", "tipo…"), variação de pitch, ritmo, hesitação semântica.
- **Vocabulário de câmera** — handheld micro-shake, focal length 35mm, natural window light 45°, sensor grain, chromatic aberration mínima.

## Arquitetura em 6 estágios

```
1. GATE:script      → JSON {hook, beats[], cta, tone, lane, age_bracket}
2. GATE:casting     → JSON {physiology, wardrobe, environment, camera, lighting, micro_behaviors[]}
3. PASS:casting     → gera imagem de referência do ator (Gemini image / Flux Pro)
4. PASS:clip1       → gera vídeo 10s a partir da imagem de casting (I2V — Wan 2.2, Kling, Veo)
5. PASS:clip2       → gera vídeo 10s semeado com último frame do clip1 (SEAM GATE ≤5/255)
6. STITCH:9:16      → ffmpeg concat + normalização de áudio → MP4 final
```

Cada `GATE:*` retorna JSON que o código valida. Cada `PASS:*` é geração real com custo — só roda se o gate anterior passou.

## Truque de encadeamento (seam)

Omni segura a imagem de referência nos **primeiros frames** antes de dissolver na cena gerada. Se você semeia o clip 2 com o **último frame renderizado** do clip 1 (e não com um still novo), o join fica invisível: seam medido em ~3/255 contra gate rígido de 5/255. Rejeite e regenere clip 2 se o diff pixel-médio no frame de emenda > 5/255.

## Contratos JSON

### GATE:script → saída
```json
{
  "hook": "12 palavras max, pattern-interrupt, sem 'você sabia'",
  "beats": [
    {"t": 0, "line": "…", "behavior": "eye_flick_left", "voice_note": "pausa 0.3s antes"},
    {"t": 3.5, "line": "…", "behavior": "nose_exhale", "voice_note": "queda de pitch"}
  ],
  "cta": "frase curta imperativa",
  "tone": "confessional|urgent|casual|expert",
  "lane": "pain|desire|curiosity|contrarian",
  "age_bracket": "26-35",
  "duration_target_s": 20
}
```

### GATE:casting → saída
```json
{
  "physiology": {"skin_texture":"visible pores + light T-zone shine","hair":"…","eyes":"…"},
  "wardrobe": "hoodie cinza claro, sem logo",
  "environment": "quarto com luz de janela lateral, cama desfeita ao fundo desfocada",
  "camera": "handheld 35mm, micro-shake, sensor APS-C, grain sutil",
  "lighting": "window light 45° esquerda, fill 1/8 stop",
  "micro_behaviors": ["eye_flick_left","lip_press","nose_exhale"]
}
```

## Como o agente deve responder

Quando o usuário disparar `/ugc` ou pedir explicitamente esse pipeline:

1. Rode `GATE:script` — LLM devolve JSON. Se validação falhar, retorne erros ao usuário e pare.
2. Rode `GATE:casting`. Idem.
3. Só então enfileire os PASS (custam créditos de Replicate/Gemini).
4. Após clip 2, meça seam. Se > 5/255, regere clip 2 (max 2 retries).
5. Stitch com ffmpeg. Persistir em Supabase Storage e salvar `final_916_url` em `imphq_ugc_jobs`.

## Tabelas / rotas

- Tabela: `public.imphq_ugc_jobs` (project_id, produto, actor_ref_url, script_json, casting_json, clip1_url, clip2_url, final_916_url, seam_metric, status, gate_errors).
- Edge function: `ugc-pipeline` (roteia por `?step=script|casting|clip1|clip2|stitch`).
- Página: `/ugc` — form de briefing + lista de jobs + player final.

## Nunca

- Nunca pular gate para "economizar tempo".
- Nunca gerar clip 2 a partir de still novo — sempre do último frame do clip 1.
- Nunca escrever prompt de vídeo diretamente — sempre via JSON validado.
- Nunca retornar prosa quando o schema pede JSON.
