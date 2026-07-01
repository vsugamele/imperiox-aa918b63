import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, KeyRound, Mail, Info, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface ZernioProjectRow {
  project_id: string;
  has_token: boolean;
  zernio_account_id: string | null;
  zernio_ad_account_id: string | null;
  zernio_health_ok: boolean | null;
  zernio_ads_last_sync: string | null;
  zernio_ads_last_sync_status: string | null;
  zernio_ads_last_sync_stats: any;
  api_key_masked: string;
}

export function ZernioTab() {
  const [rows, setRows] = useState<ZernioProjectRow[]>([]);
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("imphq_integration_credentials")
        .select("project_id, credentials")
        .eq("provider", "instagram");

      if (error) throw error;

      const mapped: ZernioProjectRow[] = (data || [])
        .filter((r: any) => r.credentials?.zernio_api_key || r.credentials?.zernio_ad_account_id)
        .map((r: any) => {
          const c = r.credentials || {};
          const key: string = c.zernio_api_key || "";
          return {
            project_id: r.project_id,
            has_token: !!c.zernio_api_key,
            zernio_account_id: c.zernio_account_id || null,
            zernio_ad_account_id: c.zernio_ad_account_id || null,
            zernio_health_ok: c.zernio_health_ok ?? null,
            zernio_ads_last_sync: c.zernio_ads_last_sync || null,
            zernio_ads_last_sync_status: c.zernio_ads_last_sync_status || null,
            zernio_ads_last_sync_stats: c.zernio_ads_last_sync_stats || null,
            api_key_masked: key ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "—",
          };
        });
      setRows(mapped);
    } catch (err: any) {
      toast.error("Erro ao carregar Zernio: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs leading-7 text-muted-foreground">
          <strong className="text-amber-400">Catálogo informativo (read-only).</strong> O token Zernio
          operacional é configurado <strong className="text-foreground">dentro de cada Projeto</strong>{" "}
          (Projeto → Integrações → Zernio). Esta aba apenas lista os projetos que já têm credenciais e o status
          da última sincronização.
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum projeto com Zernio configurado</p>
          <p className="text-xs mt-1">Vá em um projeto → aba Integrações → Zernio para conectar.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">Projeto</TableHead>
                <TableHead className="text-[10px] uppercase">Token (mascarado)</TableHead>
                <TableHead className="text-[10px] uppercase">Ad Account</TableHead>
                <TableHead className="text-[10px] uppercase">Health</TableHead>
                <TableHead className="text-[10px] uppercase">Última Sync</TableHead>
                <TableHead className="text-[10px] uppercase">Resultado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const stats = r.zernio_ads_last_sync_stats;
                const importing = stats && (stats.imported > 0 || stats.ads > 0);
                return (
                  <TableRow key={r.project_id}>
                    <TableCell className="font-medium text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {r.project_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{visibleTokens[r.project_id] ? (r.api_key_masked) : "••••••••"}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => toggleTokenVisibility(r.project_id)}>
                          {visibleTokens[r.project_id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.zernio_ad_account_id || "—"}
                    </TableCell>
                    <TableCell>
                      {r.zernio_health_ok === true ? (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                        </Badge>
                      ) : r.zernio_health_ok === false ? (
                        <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Erro
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(r.zernio_ads_last_sync)}
                    </TableCell>
                    <TableCell>
                      {stats ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${importing
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-amber-500/30 text-amber-400 bg-amber-500/10"}`}
                        >
                          {stats.imported || 0} reg · {stats.ads || 0} ads · {stats.campaigns || 0} camp
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">nunca rodou</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/projeto/${r.project_id}`} title="Abrir projeto">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
