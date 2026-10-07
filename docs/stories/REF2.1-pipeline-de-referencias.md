# REF2.1 — Pipeline de referências

**Status:** Done · 07/10/2026

## Contexto
Diagnóstico de 07/10: 606 referências, 585 sem projeto, 322 de 329 vídeos nunca transcritos, 265 imagens sem texto (o Jev não lê imagem), 12 imagens com link assinado que expira, reels salvos só como link. A mídia de 217 vídeos e 264 imagens já estava no Storage, só não era processada.

## Acceptance Criteria
- [x] `ref-pipeline` (cron `ref-pipeline-10m`): por referência, o próximo passo — guardar mídia (link assinado → bucket público `project-media/referencias`), transcrever vídeo ou ler imagem (OpenRouter `google/gemini-2.5-flash`: fala/texto, texto na tela, descrição visual, gancho, formato, nicho), etiquetar projeto (Jev, só com confiança ≥ 0,7). O ângulo segue no `jev-classify` (a cada 6h), que passa a alcançar as referências que ganharam texto.
- [x] 13 formatos (estático, carrossel, print de conversa, antes/depois, depoimento, UGC falando, demonstração, narração com b-roll, entrevista/podcast, produto, infográfico, meme, outro) em `formato`; leitura estruturada em `leitura`; estado por passo em `pipeline`.
- [x] Anti-loop: lotes pequenos (2 vídeos, 8 imagens, 10 mídias, 15 projetos por rodada), 3 tentativas por passo, para após 3 falhas seguidas; vídeo acima de 20 MB não é tentado de novo.
- [x] Validado com 1 item de cada passo antes do lote (imagem lida com texto completo, vídeo transcrito, link assinado copiado, projeto só com certeza).
- [x] "No mercado" mostra a saúde da biblioteca: vídeos transcritos, imagens lidas, com projeto, com ângulo e formatos.

## Pendente (próximas histórias)
- Mineração diária (Biblioteca de Anúncios da Meta por palavra-chave/concorrente, com dias no ar): precisa de uma chave do Apify (`APIFY_TOKEN`) ou definir outra fonte.
- Reels salvos só como link precisam do arquivo (download pelo Apify).

## File List
- supabase/migrations/20261007_imphq_ref_pipeline.sql
- supabase/functions/_shared/ref-pipeline.ts
- supabase/functions/ref-pipeline/index.ts
- src/hooks/useCopyLibrary.ts
- src/components/estrategias/MarketAngles.tsx
- src/integrations/supabase/types.ts
- src/test/ref-pipeline.test.ts
- src/test/market-angles.test.tsx
