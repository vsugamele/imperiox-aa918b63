import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertOctagon, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FailedProject {
  id: string;
  name: string;
  subcode: number | null;
  code: number | null;
  message: string;
  at: string;
  last_sync: string | null;
  kind: "error" | "empty";
  account_id?: string | null;
}

export default function FacebookHealthAlert() {
  const [failed, setFailed] = useState<FailedProject[]>([]);
  const [resyncing, setResyncing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("imphq_projects")
      .select("id, name, data")
      .not("data", "is", null);
    const list: FailedProject[] = [];
    for (const p of data || []) {
      const d: any = p.data || {};
      const hasFb = d.facebook_ad_account_id && (d.facebook_marketing_token || d.facebook_access_token);
      if (!hasFb) continue;
      if (d.facebook_sync_status === "error" && d.facebook_sync_error) {
        list.push({
          id: p.id,
          name: p.name,
          subcode: d.facebook_sync_error.subcode || null,
          code: d.facebook_sync_error.code || null,
          message: d.facebook_sync_error.message || "Erro desconhecido",
          at: d.facebook_sync_error.at || "",
          last_sync: d.facebook_last_sync || null,
          kind: "error",
          account_id: d.facebook_ad_account_id || null,
        });
      } else if (d.facebook_sync_status === "empty") {
        list.push({
          id: p.id,
          name: p.name,
          subcode: null,
          code: null,
          message: `Meta retornou 0 linhas para a conta act_${d.facebook_ad_account_id} nos últimos 7 dias`,
          at: d.facebook_sync_error?.at || d.facebook_last_sync || "",
          last_sync: d.facebook_last_sync || null,
          kind: "empty",
          account_id: d.facebook_ad_account_id || null,
        });
      }
    }
    setFailed(list);
  }

  useEffect(() => { load(); }, []);

  async function handleResync() {
    setResyncing(true);
    try {
      const { error } = await supabase.functions.invoke("facebook-ads-sync-all");
      if (error) throw error;
      toast.success("Sincronização disparada. Aguardando resultado...");
      setTimeout(() => load(), 4000);
    } catch (e: any) {
      toast.error("Falha ao disparar sync: " + (e.message || "erro"));
    } finally {
      setResyncing(false);
    }
  }

  if (failed.length === 0) return null;

  // Determine dominant error type
  const has459 = failed.some(f => f.subcode === 459);
  const has190 = failed.some(f => f.code === 190);
  const hasEmpty = failed.some(f => f.kind === "empty");
  const allEmpty = failed.every(f => f.kind === "empty");

  let title = "⚠️ Erro na sincronização do Facebook Ads";
  let detail = "Uma ou mais contas pararam de sincronizar.";
  if (has459) {
    title = "🔒 Facebook bloqueou o acesso por segurança";
    detail = "Faça login em facebook.com, resolva o checkpoint de segurança e atualize o token nas Integrações.";
  } else if (has190) {
    title = "⏰ Token do Facebook expirou";
    detail = "Renove o token de acesso em Configurações → Integrações para retomar a sincronização.";
  } else if (allEmpty) {
    title = "📉 Meta retornou 0 gastos nos últimos 7 dias";
    detail = `Verifique se o ad account configurado (${failed.map(f => `act_${f.account_id}`).join(", ")}) é realmente o que está rodando hoje. Pode estar conectado em outra conta.`;
  } else if (hasEmpty) {
    detail += " Alguns projetos não trouxeram nenhum gasto da Meta nos últimos 7 dias (conta errada ou sem campanhas ativas).";
  }

  const lastSync = failed.map(f => f.last_sync).filter(Boolean).sort().pop();
  const lastSyncStr = lastSync
    ? new Date(lastSync).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-amber-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertOctagon className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-300">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-6">{detail}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
              {failed.length} projeto{failed.length > 1 ? "s" : ""} afetado{failed.length > 1 ? "s" : ""}: {failed.map(f => f.name).join(", ")}
            </span>
            <span className="px-2 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border">
              Última coleta OK: {lastSyncStr}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-8">
        <Button asChild size="sm" variant="default" className="h-8 text-xs">
          <Link to="/configuracoes">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Renovar Token
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleResync} disabled={resyncing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${resyncing ? "animate-spin" : ""}`} />
          {resyncing ? "Sincronizando..." : "Tentar agora"}
        </Button>
      </div>
    </div>
  );
}
