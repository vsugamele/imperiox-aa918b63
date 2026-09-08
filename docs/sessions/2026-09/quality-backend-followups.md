# Backend quality follow-ups — QL1.1

## Corrected locally, awaiting integration

- `supabase/functions/openflow-resume/index.ts:96` (claim) and `:163` (owned failure): the CAS update only awaited a filtered update without checking whether a row was claimed. Two workers could both invoke the executor. It now selects the claimed id and skips dispatch if no row was updated; returned database errors take the error path.
- `supabase/functions/weekly-backup/index.ts:90`, `:104`, `:175`: select/upload/signed URL error results were ignored, allowing a success report or email with unavailable backups. Returned errors now fail the backup. Resend non-2xx now enters the existing notification error log instead of logging delivery success. No live send was performed.

## Revert contract corrected locally

- `imperius-executor`: dedicated revert dispatcher restores ad status, budget, lead state and AI pause. It checks provider rejection and missing database rows. Failed or unsupported reversals retain `executed` status so they cannot masquerade as completed undo. `createTask` and `createFlow` reject automatic undo explicitly instead of creating another item; parent approved this non-destructive contract. Eight handler regressions cover restore values (including zero), unsupported operations, missing previous budget and provider rejection.

## Validation

Latest batch: 20 owned Edge Functions with scoped ESLint zero and strict isolated TypeScript zero. Regression suite now 70 passing. No deployment or external send.

- `supabase/functions/payment-recovery/index.ts`: `recovery_sent_levels` always appends the selected level even when `sendWhatsApp` returns `{ ok: false }`. Corrected: only successful provider sends append a level. Handler regression covers failure, subsequent retry success, and then skip (two mock provider calls across three runs).

- Corrected `hot-lead-responder`: failed attempts no longer mark sent and only executed actions deduplicate. Corrected `wa-behavioral-triggers`: no follow_up_sent update unless provider confirms success. Mocked handler regressions cover HTTP failure, provider rejection, absent provider, retry success and subsequent skip. Scoped ESLint and strict isolated TypeScript both pass; suite has 57 tests.
- Corrected `meta-offline-upload`: only successful uploaded batches receive synchronized markers; failed batches and sales without matching email/phone remain pending. Regression uses 102 candidates with failed first batch, successful second batch and subsequent retry.
- Corrected `wa-consultive-followup`: failed delivery preserves previous touch number and timestamp, allowing the same touch to retry. Handler regression covers failure, success and subsequent skip.


## Final owned batch (2026-09-07)

- Scoped ESLint and strict isolated TypeScript passed for 18 indices: studio-canvas-run, imperius-scout, wa-pitch-followup, capture-lead, ig-comments-poller, ecosystem-from-name, avatar-pipeline, sales-path-engine, whatsapp-api, product-ecosystem-scan, instagram-api, wa-campaign-scheduler, assistente-diagnose, instagram-webhook, webhook-pagamento, openflow-executor, wa-ai-reply, webchat-api. The ecosystem post-sale template also passes ESLint.
- Copilot Imperius index/tools were reassigned to quality_chat and were not edited in this batch. Shared helpers and whatsapp-api/_lib remain root-owned.
- `webchat-api`: origin matching now compares actual origin/hostname boundaries, scheme and explicit ports; deceptive domain suffixes and malformed origins are denied.
- `whatsapp-api`: unavailable TTS no longer substitutes sample music; unsupported voice channels and rejected provider delivery fail without reporting a sent voice message.
- `wa-campaign-scheduler`: dedupe includes group and sent status. Failed groups can retry without resending groups already delivered; database read errors abort rather than bypass dedupe.
- `instagram-webhook`: restored valid database client name for expiring pause, defined OpenRouter key in both LLM call scopes, and fixed invalid PostgREST catch usage. Real LLM blocks execute under mocked fetch in regressions.
- `webhook-pagamento`: explicit compatible provider payload contracts retain numeric/string amounts and extension fields. Existing Deno parser/financial/UTM/CAPI tests execute in the local regression harness and pass.
- `openflow-executor`: originalStart is available to wait/stop event branches, voice settings use AI config in the correct scope, ordering uses ascending:false, and attribution no longer calls unsupported catch on PostgREST builders. Step normalizer tests cover legacy names, seconds pacing, string zero delay, media and memory interpolation.
- `wa-ai-reply`: missing projected columns added (execution status, legacy steps, handoff timestamp, pending timestamp, purchase-intent flag), incorrect ordering and invalid PostgREST catch calls corrected, message timestamp resolved from request. Partial text sends preserve only confirmed parts in history and conversation, return explicit partial failure and do not advance OpenFlow. Full confirmed delivery advances the flow. Tests cover second-part HTTP rejection, payload rejection, network failure and full success.
- Latest backend regression suite: **82 passing**. No cloud deployment, database mutation or real provider sends were performed. Isolated strict checks are local TypeScript validation, not Deno/runtime deployment validation. Parent owns global lint/type/build/test integration gates.

- Final integration check: quality-shared-types passed with the 18 indices plus every _shared/*.ts and whatsapp-api/_lib/*.ts file. Deno is not available on PATH.
- Ticto date correction: DD/MM/YYYY is parsed before generic Date/ISO parsing; 06/12/2025 10:30:00 now remains December 6 (13:30 UTC), covered alongside all existing payment parser tests. Scoped lint/strict and 82-test suite pass after this correction.
