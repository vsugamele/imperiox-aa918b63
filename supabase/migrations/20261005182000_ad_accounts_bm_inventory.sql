-- Inventário de BMs/contas de anúncio (planilha "Contas Ads V2") + saúde ao vivo via Zernio.
-- Reversível: DROP das colunas novas e do índice; DELETE das linhas com notas 'import:planilha_v2'.

ALTER TABLE public.imphq_ad_accounts
  ADD COLUMN IF NOT EXISTS bm_nome text,
  ADD COLUMN IF NOT EXISTS trust_tier text CHECK (trust_tier IS NULL OR trust_tier IN ('TIER_1','TIER_2','TIER_3')),
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS produto_funil text,
  ADD COLUMN IF NOT EXISTS moeda text,
  ADD COLUMN IF NOT EXISTS meta_account_status int,
  ADD COLUMN IF NOT EXISTS meta_billing_status text,
  ADD COLUMN IF NOT EXISTS meta_disable_reason int,
  ADD COLUMN IF NOT EXISTS meta_unusable_reason text,
  ADD COLUMN IF NOT EXISTS meta_funding text,
  ADD COLUMN IF NOT EXISTS ads_ativos int,
  ADD COLUMN IF NOT EXISTS ads_total int,
  ADD COLUMN IF NOT EXISTS ultima_checagem timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS imphq_ad_accounts_ad_account_id_key
  ON public.imphq_ad_accounts (ad_account_id);

INSERT INTO public.imphq_ad_accounts (user_id, bm_id, ad_account_id, nome, bm_nome, trust_tier, status, notas, project_id)
SELECT 'bded734b-15c0-4db3-851b-5ad763ee33c8'::uuid, '', v.id, v.nome, v.bm, v.tier, 'ativo', 'import:planilha_v2', v.proj
FROM (VALUES
  ('332327845076967','Luana','Luana Ferreira','TIER_1',NULL),
  ('1042156903760731','JP6','JP6 Studio','TIER_1',NULL),
  ('978143800889085','Julin Trader','Imperio Company','TIER_1',NULL),
  ('448271424884723','AD Vini 01','Imperio Company','TIER_1',NULL),
  ('430762366767353','Hipertens','jpfreitas06','TIER_1',NULL),
  ('971715102690873','pet select','Henderson Nunes','TIER_1',NULL),
  ('1800258540698384','Projeto AA','Henderson Nunes','TIER_1',NULL),
  ('1691677618650241','Projeto Vini','Henderson Nunes','TIER_1',NULL),
  ('1000330749087886','ar commerce - 0120','AR Commerce','TIER_2',NULL),
  ('1160144338179140','Studio Arts Tattoo','Studio Arts','TIER_2','tatuagem'),
  ('381452840798062','CA 1','Bruno Academy','TIER_2',NULL),
  ('5244611945575216','ZZZ','NonStop 1.3k #265','TIER_2',NULL),
  ('905476575075144','Conta 06 - Str','Bruno Academy','TIER_2',NULL),
  ('1286199002715554','Conta Vini 08','Bruno Academy','TIER_2',NULL),
  ('1794034788063280','Conta VIni 07','Bruno Academy','TIER_2',NULL),
  ('630576512985182','Conta Laise New','Bruno Academy','TIER_2','laise'),
  ('409426678174135','New Bruno','Bruno Souza de Carvalho','TIER_3','jp_freitas'),
  ('445827787949594','Zero New','Bruno Souza de Carvalho','TIER_3',NULL),
  ('531798419993918','Sr Romrom','Bruno Souza de Carvalho','TIER_3',NULL)
) AS v(id, nome, bm, tier, proj)
ON CONFLICT (ad_account_id) DO UPDATE
  SET bm_nome = EXCLUDED.bm_nome,
      trust_tier = EXCLUDED.trust_tier,
      project_id = COALESCE(public.imphq_ad_accounts.project_id, EXCLUDED.project_id);
