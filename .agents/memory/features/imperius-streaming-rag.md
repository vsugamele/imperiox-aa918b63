---
name: Imperius Streaming + RAG
description: Copilot Imperius com SSE streaming e RAG via pgvector sobre briefings/avatares/swipes/skills
type: feature
---
- Edge function `copilot-imperius` retorna SSE (`stream: true` no body, default). Tee do upstream OpenRouter via TransformStream, persiste thread no `flush()`, envia evento `{type:"meta",threadId,sources}` no fim.
- `CopilotPanel.tsx` consome via `fetch()` direto (não `functions.invoke`) com `Authorization: Bearer ${session.access_token}` e `apikey: VITE_SUPABASE_PUBLISHABLE_KEY`. Atualiza última mensagem assistant incrementalmente.
- Tabela `imphq_rag_chunks` (vector 768, HNSW cosine). RPC `match_rag_chunks(query_embedding, p_project_id, top_k, min_similarity)`.
- Edge function `rag-indexer` (POST `{projectId?, sources?:["project","swipe","skill"]}`). Idempotente via `content_hash` SHA256. Usa `getCachedEmbedding` do `_shared/embeddings.ts`.
- Skills são chunks globais (`project_id = NULL`), match_rag_chunks retorna globais + do projeto.
