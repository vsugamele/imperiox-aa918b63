import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, RefreshCw, CheckCircle2, AlertTriangle, Settings } from "lucide-react";
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
      toast.success(`✅ Zernio: ${data.imported} registros, ${data.ads} ads, ${data.campaigns} campanhas`);
      setLastSync(new Date().toISOString());
      setLastStatus("success");
      setLastError(null);
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


  if (!hasZernio) return null;

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
    </>
  );
}
