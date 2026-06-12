import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
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


  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zernio-ads-accounts", { body: { project_id: projectId } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setAccounts(data.accounts || []);
      if (!selected && savedAcc) setSelected(savedAcc);
    } catch (e: any) {
      toast.error(`Falha ao listar contas Zernio: ${e?.message || e}`);
    } finally {
      setLoading(false);
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
      setOpen(false);
      onAfterSync?.();
    } catch (e: any) {
      toast.error(`Falha sync Zernio: ${e?.message || e}`);
    } finally {
      setSyncing(false);
    }
  };

  if (!hasZernio) return null;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          onClick={() => { setOpen(true); loadAccounts(); }}
          title={lastSync ? `Último sync Zernio: ${new Date(lastSync).toLocaleString("pt-BR")}` : "Sync via Zernio"}
        >
          <Zap className="h-3.5 w-3.5 mr-1" /> Sync Zernio
        </Button>
        {savedAcc && (
          <Button
            size="sm"
            variant="ghost"
            className="text-purple-400 hover:bg-purple-500/10 h-7 px-2"
            disabled={syncing}
            onClick={() => runSync(savedAcc)}
            title="Sincronizar conta padrão"
          >
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
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
