
## Execução em sequência

### Bloco 1 — Dívidas técnicas (agora)
1. **`content-cluster/index.ts`**: retry 1x com backoff 800ms em 429/500; retornar `failed_formats[]` no payload.
2. **`ContentGenerator.tsx`**: detectar `failed_formats` e renderizar botão "Tentar novamente" por formato (chama `content-cluster` só com aquele format).
3. **Novo `src/components/projeto/avatar/ConfidenceBadge.tsx`**: pill 🟢≥75 / 🟡 50-74 / 🔴<50, tooltip listando IDs de evidência de `_avatar_meta`.
4. **Integração nos tabs**: `PerfilTab`, `DoresTab`, `DesejosTab`, `ProblemasTab` — badge ao lado dos campos-chave lendo de `avatar._avatar_meta[campo]`.
5. **`ProjetoAvatar.tsx`**: calcular score médio do `_avatar_meta`, barra de saúde no header + badge "Recomendado: rodar pipeline" se <50% ou ausente.

### Bloco 2 — OpenAI gpt-image-1 (depois do 1)
- Vou pausar e pedir `OPENAI_API_KEY` via `add_secret`.
- Adicionar provider `openai-image` na `creative-factory/index.ts`.
- Seletor de provider no `/criativos/novo` (Gemini Nano Banana / OpenAI gpt-image-1).

### Bloco 3 — Automação proativa (por último)
- `pg_cron` diário 08:00 BRT (11:00 UTC) chamando `daily-stories-ideas` pra projetos `status='vendendo'`.
- Botão one-click "Avatar → Copy Arsenal" no `CopyArsenalTab` (gera 5 ângulos a partir de top dores/desejos).

**Sem mudanças de schema necessárias** — `_avatar_meta`, `cluster_id`, `failed_formats` cabem no JSONB e response existentes.

Confirma com **"vai"** que saio do plan mode e toco Bloco 1 → pauso pro secret do Bloco 2 → Bloco 3.
