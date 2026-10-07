import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, Save, Send } from "lucide-react";
import { toast } from "sonner";

interface ProjectRow {
  id: string;
  name: string;
  fb_pixel_id: string | null;
  fb_access_token: string | null;
  fb_test_event_code: string | null;
  settings: Record<string, unknown> | null;
}
interface LogRow { project_id: string; event_name: string; ok: boolean; match_keys: string[] | null; error: string | null }
interface Stats { total: number; ok: number; lastError: string | null; byEvent: Record<string, number>; coverage: Record<string, number> }

const KEYS: Array<[string, string]> = [["fbc", "fbc"], ["fbp", "fbp"], ["em", "e-mail"], ["ph", "telefone"], ["client_ip_address", "IP"], ["external_id", "visitor"]];

/** Pixel + token da Conversions API por projeto, com saúde dos envios das últimas 24h (imphq_capi_log). */
export function MetaCapiCard() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<ProjectRow> & { valueMode?: string }>>({});
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [proj, logs] = await Promise.all([
      supabase.from("imphq_projects").select("id, name, fb_pixel_id, fb_access_token, fb_test_event_code, settings").eq("active", true).order("name"),
      supabase.from("imphq_capi_log" as never).select("project_id, event_name, ok, match_keys, error").gte("created_at", since).limit(5000),
    ]);
    setProjects((proj.data as unknown as ProjectRow[]) || []);
    const s: Record<string, Stats> = {};
    for (const l of ((logs.data as unknown as LogRow[]) || [])) {
      const cur = (s[l.project_id] ||= { total: 0, ok: 0, lastError: null, byEvent: {}, coverage: {} });
      cur.total++;
      if (l.ok) cur.ok++; else cur.lastError = l.error;
      cur.byEvent[l.event_name] = (cur.byEvent[l.event_name] || 0) + 1;
      for (const k of l.match_keys || []) cur.coverage[k] = (cur.coverage[k] || 0) + 1;
    }
    setStats(s);
  }, []);
  useEffect(() => { load(); }, [load]);

  const field = (p: ProjectRow, k: "fb_pixel_id" | "fb_access_token" | "fb_test_event_code") => (drafts[p.id]?.[k] ?? p[k] ?? "") as string;
  const valueMode = (p: ProjectRow) => drafts[p.id]?.valueMode
    ?? ((p.settings || {}).meta_purchase_source === "plataforma" ? "plataforma" : String((p.settings || {}).meta_purchase_value ?? "comissao"));
  const setDraft = (id: string, patch: Partial<ProjectRow> & { valueMode?: string }) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async (p: ProjectRow) => {
    setBusy(p.id);
    const mode = valueMode(p);
    const { error } = await supabase.from("imphq_projects").update({
      fb_pixel_id: field(p, "fb_pixel_id").trim() || null,
      fb_access_token: field(p, "fb_access_token").trim() || null,
      fb_test_event_code: field(p, "fb_test_event_code").trim() || null,
      settings: {
        ...(p.settings || {}),
        meta_purchase_source: mode === "plataforma" ? "plataforma" : "imperio",
        meta_purchase_value: mode === "plataforma" ? ((p.settings || {}).meta_purchase_value ?? "comissao") : mode,
      },
    } as never).eq("id", p.id);
    setBusy(null);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(`${p.name}: Meta salvo`);
    setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; });
    load();
  };

  const resend = async (p: ProjectRow) => {
    setBusy(p.id);
    const { data, error } = await supabase.functions.invoke("meta-offline-upload", { body: { project_id: p.id } });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const r = (data as { results?: Array<{ uploaded?: number; reason?: string; errors?: string[]; skipped_no_match?: number }> })?.results?.[0];
    if (r?.reason) toast.warning(`Não enviado: ${r.reason === "missing_pixel_or_token" ? "falta Pixel ou token" : r.reason}`);
    else if (r?.errors?.length) toast.error(`Meta recusou: ${r.errors[0]}`);
    else toast.success(`${r?.uploaded ?? 0} compra(s) enviada(s) via CAPI${r?.skipped_no_match ? ` · ${r.skipped_no_match} sem dado de match` : ""}`);
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /> Meta: Pixel + Conversions API</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada etapa do funil vai para a Meta pelo navegador e pelo servidor com o mesmo ID, e a Meta descarta a duplicata. A compra sai só pelo servidor quando a venda é aprovada.
          O token fica em Gerenciador de Eventos → Pixel → Configurações → Gerar token de acesso.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.map((p) => {
          const st = stats[p.id];
          const ready = !!(field(p, "fb_pixel_id") && field(p, "fb_access_token"));
          const dirty = !!drafts[p.id];
          return (
            <div key={p.id} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {p.name}
                  {ready ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 text-[10px]">CAPI ativa</Badge>
                    : <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">{field(p, "fb_pixel_id") ? "Falta token" : "Sem Pixel"}</Badge>}
                  {p.fb_test_event_code && <Badge variant="outline" className="text-sky-400 border-sky-500/40 text-[10px]">Modo teste</Badge>}
                </div>
                {st && (
                  <div className="text-[11px] text-muted-foreground">
                    24h: <span className={st.ok === st.total ? "text-emerald-400" : "text-rose-400"}>{st.ok}/{st.total} aceitos</span>
                    {" · "}{Object.entries(st.byEvent).map(([e, n]) => `${e} ${n}`).join(" · ")}
                  </div>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_1fr_auto]">
                <Input className="h-8 text-xs" placeholder="Pixel ID" value={field(p, "fb_pixel_id")} onChange={(e) => setDraft(p.id, { fb_pixel_id: e.target.value })} />
                <Input className="h-8 text-xs" type="password" placeholder="Token da Conversions API" value={field(p, "fb_access_token")} onChange={(e) => setDraft(p.id, { fb_access_token: e.target.value })} />
                <Input className="h-8 text-xs" placeholder="Código de teste (opcional)" value={field(p, "fb_test_event_code")} onChange={(e) => setDraft(p.id, { fb_test_event_code: e.target.value })} />
                <Select value={valueMode(p)} onValueChange={(v) => setDraft(p.id, { valueMode: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comissao">Valor = comissão</SelectItem>
                    <SelectItem value="preco">Valor = preço pago</SelectItem>
                    <SelectItem value="plataforma">Compra já vai pelo checkout</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" className="h-8" disabled={!dirty || busy === p.id} onClick={() => save(p)}><Save className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={!ready || busy === p.id} onClick={() => resend(p)} title="Enviar compras pendentes dos últimos 7 dias">
                    <Send className="h-3.5 w-3.5" /> Compras
                  </Button>
                </div>
              </div>
              {st && st.total > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="text-muted-foreground">Dados de match:</span>
                  {KEYS.map(([k, label]) => {
                    const pct = Math.round(((st.coverage[k] || 0) / st.total) * 100);
                    return <Badge key={k} variant="outline" className={pct >= 70 ? "text-emerald-400" : pct >= 30 ? "text-amber-400" : "text-rose-400"}>{label} {pct}%</Badge>;
                  })}
                </div>
              )}
              {st?.lastError && <p className="text-[11px] text-rose-400 truncate" title={st.lastError}>Último erro da Meta: {st.lastError}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
