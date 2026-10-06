# IA2.1 — Feed "A IA fez" (agir e contar depois)

**Status:** Done · 07/10/2026

## Contexto
Vinicius: "é legal essa independência da IA tomando decisão e resolvendo... talvez vale: respondi assim, fiz assim, você faria diferente?". A tela Aprovar pedia permissão antes; agora a IA age e o time revisa depois.

## Acceptance Criteria
- [x] `/aprovar` abre em "A IA fez"; a fila antiga vira "Precisa de você" (só o que a IA não pode fazer sozinha).
- [x] Feed das últimas 48h: respostas da IA no WhatsApp (com a mensagem do lead que veio antes), recuperações de Pix (resposta imediata e régua, com "pagou depois ✓"), respostas ensinadas ao acervo pela triagem e ações executadas automaticamente.
- [x] Cada card: "Tá certo" ou "Faria diferente" com texto. Resposta no WhatsApp: usa o `wa-feedback-learn` existente (👍 vira par no acervo; correção vira resposta ou regra). Acervo: correção substitui a resposta; sem texto, sai do acervo.
- [x] Revisões gravadas em `imphq_ai_feedback` (uma por item); filtro "só sem revisão" e contagem por tipo.

## Próximo
- IA2.2: liberação de acesso na área de membros pelo bot, aparecendo neste feed.

## File List
- supabase/migrations/20261007_imphq_ai_feedback.sql
- supabase/functions/_shared/ai-feed.ts
- src/hooks/useAiFeed.ts
- src/components/aprovar/AiDidFeed.tsx
- src/pages/Aprovar.tsx
- src/integrations/supabase/types.ts
- src/test/ai-feed.test.tsx
- src/test/aprovar.test.tsx
