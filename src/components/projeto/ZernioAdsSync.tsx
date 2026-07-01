import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, RefreshCw, CheckCircle2, AlertTriangle, Settings, Bug } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ZernioAccount {
  id: string;
  name: string;
  currency?: string;
  businessName?: string;
  accountStatus?: number;
}

interface Props {
  projectId: string;
  dateRange?: { start: Date; end: Date } | null;
  onAfterSync?: () => void;
}

export default function ZernioAdsSync({ projectId, dateRange, onAfterSync }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<ZernioAccount[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [savedAcc, setSavedAcc] = useState<string | undefined>();
  const [hasZernio, setHasZernio] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<any>(null);
  const [lastDebug, setLastDebug] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Load saved Zernio config
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", projectId)
        .eq("provider", "instagram")
        .maybeSingle();
      const c: any = data?.credentials || {};
      const ok = !!(c.zernio_api_key && c.zernio_account_id);
      setHasZernio(ok);
      setSavedAcc(c.zernio_ad_account_id);
      setLastSync(c.zernio_ads_last_sync || null);
      setLastStatus(c.zernio_ads_last_sync_status || null);
      setLastError(c.zernio_ads_last_sync_error || null);
      setLastStats(c.zernio_ads_last_sync_stats || null);
      setLastDebug(c.zernio_ads_last_sync_debug || null);
    })();
  }, [projectId]);


  const loadAccounts = async (): Promise<ZernioAccount[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zernio-ads-accounts", { body: { project_id: projectId } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const list: ZernioAccount[] = data.accounts || [];
      setAccounts(list);
      if (!selected && savedAcc) setSelected(savedAcc);
      return list;
    } catch (e: any) {
      toast.error(`Falha ao listar contas Zernio: ${e?.message || e}`);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleSmartSync = async () => {
    if (savedAcc) {
      runSync(savedAcc);
      return;
    }
    const list = await loadAccounts();
    if (list.length === 1) {
      toast.success(`Conta Zernio detectada: ${list[0].name}`);
      runSync(list[0].id);
    } else if (list.length === 0) {
      toast.error("Nenhuma Ad Account vinculada na sua workspace Zernio.");
    } else {
      setOpen(true);
      setSelected(list[0].id);
    }
  };

  const runSync = async (adAccountId: string) => {
    setSyncing(true);
    try {
      const body: any = { project_id: projectId, ad_account_id: adAccountId };
      if (dateRange) {
        body.date_from = format(dateRange.start, "yyyy-MM-dd");
        body.date_to = format(dateRange.end, "yyyy-MM-dd");
      }
      const { data, error } = await supabase.functions.invoke("zernio-ads-sync", { body });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const importedN = data.imported ?? 0;
      const adsN = data.ads ?? 0;
      const campN = data.campaigns ?? 0;
      if (importedN === 0 && adsN === 0 && campN === 0) {
        toast.warning(`⚠️ Zernio retornou 0 campanhas. Veja o diagnóstico para entender por quê.`);
      } else {
        toast.success(`✅ Zernio: ${importedN} registros, ${adsN} ads, ${campN} campanhas`);
      }
      setLastSync(new Date().toISOString());
      setLastStatus("success");
      setLastError(null);
      setLastStats({ imported: importedN, ads: adsN, campaigns: campN });
      setLastDebug(data.debug || null);
      setOpen(false);
      onAfterSync?.();
    } catch (e: any) {
      const msg = e?.message || String(e);
      setLastSync(new Date().toISOString());
      setLastStatus("error");
      setLastError(msg);
      toast.error(`Falha sync Zernio: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const relTime = (iso: string | null) => {
    if (!iso) return null;
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };


  if (!hasZernio) {
    return (
      <Link to="/empresa" title="Configurar token Zernio em Empresa > Integrações">
        <Button
          size="sm"
          variant="outline"
          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Configurar Zernio
        </Button>
      </Link>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          disabled={syncing || loading}
          onClick={handleSmartSync}
          title={
            !savedAcc
              ? "Detecta automaticamente a conta Zernio e sincroniza"
              : lastSync
                ? `Último sync: ${new Date(lastSync).toLocaleString("pt-BR")}${lastError ? `\nErro: ${lastError}` : ""}`
                : "Sync via Zernio"
          }
        >
          {(syncing || loading) ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
          Sync Zernio
          {!savedAcc && !syncing && !loading && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-amber-400">
              <AlertTriangle className="h-3 w-3" /> configurar
            </span>
          )}
          {savedAcc && lastStatus === "success" && lastSync && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-green-400">
              <CheckCircle2 className="h-3 w-3" /> {relTime(lastSync)}
            </span>
          )}
          {savedAcc && lastStatus === "error" && lastSync && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-red-400">
              <AlertTriangle className="h-3 w-3" /> {relTime(lastSync)}
            </span>
          )}
        </Button>
        {savedAcc && (
          <Button
            size="sm"
            variant="ghost"
            className="text-purple-400 hover:bg-purple-500/10 h-7 px-2"
            disabled={syncing}
            onClick={() => { setOpen(true); loadAccounts(); }}
            title="Trocar Ad Account"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
        {(lastStats && (lastStats.imported === 0 && lastStats.ads === 0)) || lastDebug ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-400 hover:bg-amber-500/10 h-7 px-2"
            onClick={() => setShowDebug(true)}
            title="Ver diagnóstico do último sync"
          >
            <Bug className="h-3 w-3" />
          </Button>
        ) : null}
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-secondary/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-purple-400">Sync Meta Ads via Zernio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground leading-7">
              Selecione a conta de anúncios Meta disponível na sua workspace Zernio. A sincronização
              importa campanhas, anúncios e insights diários (sem precisar de App Review da Meta).
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando contas...</div>
            ) : (
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Escolha uma Ad Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.businessName ? `· ${a.businessName}` : ""} ({a.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {lastSync && (
              <p className="text-xs text-muted-foreground">
                Último sync: {new Date(lastSync).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={syncing}>Cancelar</Button>
            <Button
              className="bg-purple-500 hover:bg-purple-600"
              disabled={!selected || syncing}
              onClick={() => selected && runSync(selected)}
            >
              {syncing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sincronizando...</> : "Sincronizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDebug} onOpenChange={setShowDebug}>
        <DialogContent className="bg-secondary/40 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Bug className="h-4 w-4" /> Diagnóstico Zernio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs leading-7">
            <div>
              <p className="text-muted-foreground">Último sync: <strong className="text-foreground">{lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "—"}</strong></p>
              <p className="text-muted-foreground">Resultado: <strong className="text-foreground">{lastStats ? `${lastStats.imported} reg · ${lastStats.ads} ads · ${lastStats.campaigns} camp` : "—"}</strong></p>
              {lastStats && (
                <>
                  <p className="text-muted-foreground">
                    Insights: <strong className="text-foreground">{lastStats.insights_empty ?? 0} vazias</strong> · <strong className="text-foreground">{lastStats.insights_failures ?? 0} falhas</strong>
                    {lastStats.chosen_insights_variant && <> · variante: <code className="text-emerald-400">{lastStats.chosen_insights_variant}</code></>}
                  </p>
                  <p className="text-muted-foreground">
                    Inline real: <strong className="text-emerald-400">{lastStats.inline_metrics_used ?? 0}</strong> · Forçando /insights: <strong className="text-amber-400">{lastStats.ads_zero_forcing_insights ?? 0}</strong> · Dias importados: <strong className="text-foreground">{lastStats.days_imported ?? 0}</strong> · Campanhas placeholder: <strong className="text-foreground">{lastStats.campaign_placeholders ?? 0}</strong>
                  </p>
                </>
              )}
              <p className="text-muted-foreground">Ad Account: <code className="text-foreground">{savedAcc || "—"}</code></p>
            </div>
            {lastDebug?.campaigns_detected && lastDebug.campaigns_detected.length > 0 && (
              <div>
                <p className="font-semibold mb-1 text-foreground">Campanhas detectadas ({lastDebug.campaigns_detected.length}):</p>
                <div className="rounded border border-border/40 max-h-48 overflow-auto divide-y divide-border/40">
                  {lastDebug.campaigns_detected.map((c: any, i: number) => (
                    <div key={i} className="px-2 py-1.5 flex items-center justify-between text-[11px]">
                      <span className="truncate flex-1 mr-2">{c.name || "—"}</span>
                      <span className="text-muted-foreground">{c.ads_count} ads</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${c.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : c.status === "PAUSED" ? "bg-amber-500/15 text-amber-400" : "bg-muted text-muted-foreground"}`}>{c.status || "?"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lastDebug?.variants_tried && (
              <div>
                <p className="font-semibold mb-1 text-foreground">Variantes de parâmetro testadas:</p>
                <div className="rounded border border-border/40 divide-y divide-border/40 overflow-hidden">
                  {lastDebug.variants_tried.map((v: any, i: number) => (
                    <div key={i} className={`px-2 py-1.5 ${v.name === lastDebug.chosen_variant ? "bg-emerald-500/10" : ""}`}>
                      <div className="flex items-center justify-between">
                        <code className="text-[11px]">{v.name}</code>
                        {v.name === lastDebug.chosen_variant && <span className="text-[10px] text-emerald-400">✓ usada</span>}
                      </div>
                      <p className="text-muted-foreground text-[10px]">
                        campaigns: {v.campaigns_count} (HTTP {v.campaigns_status}) · ads: {v.ads_count} (HTTP {v.ads_status})
                      </p>
                      <p className="text-muted-foreground text-[10px] truncate">
                        keys campaigns: [{(v.campaigns_keys || []).join(", ")}] · keys ads: [{(v.ads_keys || []).join(", ")}]
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lastStats && lastStats.ads > 0 && lastStats.imported === 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-amber-300/90 leading-6">
                <strong>Ads encontrados mas insights vazios.</strong> Causas comuns:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Sem gastos/impressões no período selecionado (últimos 30 dias).</li>
                  <li>Endpoint de insights da Zernio espera outro formato de parâmetro — verifique a amostra abaixo.</li>
                  <li>A Ad Account ainda não terminou de processar dados no Zernio.</li>
                </ul>
                {lastDebug?.sample_empty_insight && (
                  <p className="mt-1 text-[10px] font-mono">amostra: adId={lastDebug.sample_empty_insight.adId} · HTTP {lastDebug.sample_empty_insight.status} · keys=[{(lastDebug.sample_empty_insight.keys || []).join(", ")}]</p>
                )}
              </div>
            )}
            {lastStats && lastStats.imported === 0 && lastStats.ads === 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-amber-300/90 leading-6">
                <strong>Zero resultados em todas as variantes.</strong> Causas comuns:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>A Ad Account precisa ser <strong>habilitada/sincronizada</strong> no painel Zernio (zernio.com → Ads).</li>
                  <li>Sem campanhas ativas no período (sync busca últimos 30 dias por padrão).</li>
                  <li>O token Zernio não tem permissão para essa Ad Account.</li>
                </ul>
              </div>
            )}
            {lastError && (
              <div className="rounded border border-red-500/30 bg-red-500/5 p-2 text-red-300 text-[11px] font-mono whitespace-pre-wrap">
                {lastError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDebug(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
