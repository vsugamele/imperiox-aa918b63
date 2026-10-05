// Atualiza a saúde das contas de anúncio (imphq_ad_accounts) a partir da Zernio:
// status na Meta, cobrança, motivo de bloqueio, saldo/forma de pagamento, BM real e nº de anúncios ativos.
// Chamado ao fim de zernio-ads-sync-all (cron a cada 6h) ou pelo botão "Checar agora" em Empresa → Contas de anúncio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const ZERNIO_BASE = "https://zernio.com/api/v1";

type ZAccount = {
  id?: string; name?: string; currency?: string; businessId?: string; businessName?: string;
  accountStatus?: number; billingStatus?: string; disableReason?: number; unusableReason?: string | null;
  fundingSourceDetails?: { displayString?: string } | null;
};
type ZAd = { platformAdAccountId?: string; status?: string; effectiveStatus?: string };

async function zGet(path: string, apiKey: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const r = await fetch(`${ZERNIO_BASE}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: (body && typeof body === "object" ? body : {}) as Record<string, unknown> };
}

const stripAct = (id: string | undefined | null) => (id || "").replace(/^act_/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Só service role (cron/sync-all) ou usuário logado.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (token !== SERVICE_KEY) {
      const { data: u } = await supabase.auth.getUser(token);
      if (!u?.user) return new Response(JSON.stringify({ error: "login obrigatório" }), { status: 401, headers: jsonHeaders });
    }

    // Credenciais Zernio Ads distintas (uma chave pode servir vários projetos).
    const { data: rows, error } = await supabase
      .from("imphq_integration_credentials")
      .select("project_id, credentials")
      .eq("provider", "instagram");
    if (error) throw error;
    const creds = new Map<string, { key: string; acc: string }>();
    for (const r of rows || []) {
      const c = (r.credentials || {}) as Record<string, string | undefined>;
      const key = c.zernio_ads_api_key || c.zernio_api_key;
      const acc = c.zernio_ads_account_id || c.zernio_account_id;
      if (key && acc) creds.set(`${key}|${acc}`, { key, acc });
    }

    const accounts = new Map<string, ZAccount>();
    const adCounts = new Map<string, { total: number; active: number }>();
    const debug: Record<string, unknown>[] = [];

    for (const { key, acc } of creds.values()) {
      const a = await zGet(`/ads/accounts?accountId=${encodeURIComponent(acc)}`, key);
      const list = Array.isArray(a.body.accounts) ? (a.body.accounts as ZAccount[]) : [];
      debug.push({ acc, accounts_status: a.status, accounts: list.length });
      for (const x of list) if (x.id) accounts.set(stripAct(x.id), x);
      if (!list.length) continue;

      // Contagem de anúncios por conta (lista paginada, 50 por página).
      for (let page = 1; page <= 30; page++) {
        const r = await zGet(`/ads?accountId=${encodeURIComponent(acc)}&source=all&page=${page}&limit=50`, key);
        if (!r.ok) break;
        const ads = (Array.isArray(r.body.ads) ? r.body.ads : Array.isArray(r.body.data) ? r.body.data : []) as ZAd[];
        for (const ad of ads) {
          const id = stripAct(ad.platformAdAccountId);
          if (!id) continue;
          const cur = adCounts.get(id) || { total: 0, active: 0 };
          cur.total++;
          if (String(ad.effectiveStatus || ad.status || "").toLowerCase() === "active") cur.active++;
          adCounts.set(id, cur);
        }
        if (ads.length < 50) break;
      }
    }

    const { data: mine, error: e2 } = await supabase.from("imphq_ad_accounts").select("id, ad_account_id, bm_id, bm_nome");
    if (e2) throw e2;

    const now = new Date().toISOString();
    let updated = 0;
    const notFound: string[] = [];
    for (const row of mine || []) {
      const id = stripAct(row.ad_account_id);
      const z = accounts.get(id);
      if (!z) { notFound.push(id); continue; }
      const counts = adCounts.get(id) || { total: 0, active: 0 };
      const { error: ue } = await supabase.from("imphq_ad_accounts").update({
        bm_id: row.bm_id || z.businessId || "",
        bm_nome: row.bm_nome || z.businessName || null,
        moeda: z.currency ?? null,
        meta_account_status: z.accountStatus ?? null,
        meta_billing_status: z.billingStatus ?? null,
        meta_disable_reason: z.disableReason ?? null,
        meta_unusable_reason: z.unusableReason ?? null,
        meta_funding: z.fundingSourceDetails?.displayString ?? null,
        ads_total: counts.total,
        ads_ativos: counts.active,
        ultima_checagem: now,
      }).eq("id", row.id);
      if (!ue) updated++;
    }

    const known = new Set((mine || []).map((r) => stripAct(r.ad_account_id)));
    const uncatalogued = [...accounts.values()]
      .filter((z) => z.id && !known.has(stripAct(z.id)) && z.accountStatus === 1)
      .map((z) => ({ id: stripAct(z.id), name: z.name, bm: z.businessName, ads_ativos: adCounts.get(stripAct(z.id))?.active || 0 }));

    return new Response(JSON.stringify({
      success: true, zernio_accounts: accounts.size, updated, not_found_in_zernio: notFound, uncatalogued_active: uncatalogued, debug,
    }), { headers: jsonHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[zernio-ad-accounts-sync] fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
