// Sala de máquinas (Story OP1.3): a saúde do Império numa tela — rotinas, ações automáticas, webhooks, anúncios,
// chips, Instagram, voz, custo de IA, fontes por projeto e banco. Mesma regra da CLI (scripts/health.mjs).
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CircleAlert,
  Info,
  Loader2,
  RefreshCw,
  Smartphone,
  Key,
  BellOff,
  Bell,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { alertCounts, machineAlerts, type MachineAlert, type MachineRoom, type Severity } from "@shared/machine-room";
import ConnectWhatsAppModal from "@/components/whatsapp/ConnectWhatsAppModal";
import { toast } from "sonner";

const AREA_LABEL: Record<string, string> = {
  rotinas: "Rotinas",
  acoes: "Ações automáticas",
  webhooks: "Webhooks",
  anuncios: "Anúncios",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  voz: "Voz",
  custo: "Custo de IA",
  fontes: "Fontes",
  banco: "Banco",
};

const SEVERITY: Record<Severity, { label: string; icon: typeof CircleAlert; cls: string }> = {
  erro: { label: "Erro", icon: CircleAlert, cls: "text-destructive border-destructive/40 bg-destructive/10" },
  atencao: { label: "Atenção", icon: AlertTriangle, cls: "text-warning border-warning/40 bg-warning/10" },
  info: { label: "Info", icon: Info, cls: "text-muted-foreground border-border bg-secondary/40" },
};

const STORAGE_SILENCED_KEY = "imphq_sala_maquinas_silenciados";

function alertKey(a: MachineAlert): string {
  return `${a.area}::${a.titulo}`;
}

async function loadMachineRoom(): Promise<MachineRoom> {
  const { data, error } = await supabase.rpc("imphq_machine_room");
  if (error) throw error;
  return (typeof data === "string" ? JSON.parse(data) : data) as unknown as MachineRoom;
}

function extractProjectIdFromAlert(alert: MachineAlert, projects: Array<{ id: string; name: string }>): string | undefined {
  const adsMatch = alert.titulo.match(/Gasto de anúncio de ([^:]+):/i);
  if (adsMatch) {
    const raw = adsMatch[1].trim().toLowerCase();
    const found = projects.find((p) => p.id.toLowerCase() === raw || p.name.toLowerCase() === raw);
    if (found) return found.id;
    return raw;
  }
  const waMatch = alert.titulo.match(/(?:Chip|Instância) "[^"]+"\s*\(([^)]+)\)/i);
  if (waMatch) {
    const raw = waMatch[1].trim().toLowerCase();
    const found = projects.find((p) => p.id.toLowerCase() === raw || p.name.toLowerCase() === raw);
    if (found) return found.id;
  }
  return undefined;
}

function extractWhatsAppInfoFromAlert(alert: MachineAlert, projects: Array<{ id: string; name: string }>) {
  const match = alert.titulo.match(/(?:Chip|Instância) "([^"]+)"(?:\s*\(([^)]+)\))?/i);
  if (!match) return null;
  const instanceName = match[1];
  const rawProj = match[2]?.trim();
  const project = projects.find((p) => p.id === rawProj || p.name.toLowerCase() === rawProj?.toLowerCase());
  return {
    instance_name: instanceName,
    project_id: project ? project.id : (rawProj && rawProj !== "?" ? rawProj : undefined),
    display_name: instanceName,
  };
}

// Modal para renovação rápida de Token da Meta
function RenovarTokenDialog({
  open,
  onOpenChange,
  defaultProjectId,
  projects,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  projects: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [token, setToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultProjectId && projects.some((p) => p.id === defaultProjectId)) {
        setProjectId(defaultProjectId);
      } else if (projects.length > 0) {
        setProjectId(projects[0].id);
      }
      setToken("");
    }
  }, [open, defaultProjectId, projects]);

  const handleSave = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      toast.error("Informe o novo token de acesso");
      return;
    }
    if (!projectId) {
      toast.error("Selecione o projeto");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Atualiza imphq_projects.data
      const { data: projectRow, error: pErr } = await supabase
        .from("imphq_projects")
        .select("data")
        .eq("id", projectId)
        .single();
      if (pErr) throw pErr;

      const currentData = (projectRow?.data && typeof projectRow.data === "object" && !Array.isArray(projectRow.data))
        ? (projectRow.data as Record<string, unknown>)
        : {};

      const updatedData = {
        ...currentData,
        facebook_access_token: cleanToken,
        facebook_marketing_token: cleanToken,
        facebook_sync_error: null,
        facebook_sync_code: null,
        facebook_sync_status: "ready",
      };

      const { error: updateErr } = await supabase
        .from("imphq_projects")
        .update({ data: updatedData })
        .eq("id", projectId);
      if (updateErr) throw updateErr;

      // 2. Se houver registro em imphq_integration_credentials, atualiza também
      try {
        const { data: creds } = await supabase
          .from("imphq_integration_credentials")
          .select("id, credentials")
          .eq("project_id", projectId)
          .eq("provider", "facebook")
          .maybeSingle();

        if (creds) {
          const credsObj = (creds.credentials && typeof creds.credentials === "object") ? creds.credentials : {};
          await supabase
            .from("imphq_integration_credentials")
            .update({
              credentials: {
                ...credsObj,
                access_token: cleanToken,
                marketing_token: cleanToken,
              },
            })
            .eq("id", creds.id);
        }
      } catch {
        // não-bloqueante
      }

      // 3. Dispara sincronização em segundo plano para testar de imediato
      try {
        await supabase.functions.invoke("facebook-ads-sync", {
          body: { project_id: projectId },
        });
      } catch {
        // o cron vai rodar de qualquer forma
      }

      toast.success("Token da Meta salvo com sucesso! O sync de anúncios foi retomado.");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao salvar token: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-500" />
            Renovar Token da Meta
          </DialogTitle>
          <DialogDescription>
            Insira o novo token de acesso do Facebook Marketing API para restabelecer a sincronização de gastos e métricas de anúncios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="token-project">Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="token-project">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta-token">Novo Access Token (EAAB...)</Label>
              <a
                href="https://business.facebook.com/settings/system-users"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary flex items-center gap-1 hover:underline"
              >
                Abrir Business Manager <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Textarea
              id="meta-token"
              placeholder="Cole aqui o token de longa duração gerado no Business Manager"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O token deve ter as permissões <code className="text-foreground font-mono">ads_read</code>, <code className="text-foreground font-mono">ads_management</code> e <code className="text-foreground font-mono">read_insights</code>.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !token.trim()} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar e Retomar Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalaMaquinas() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [scope, setScope] = useState<"ativas" | "todas" | "silenciadas">("ativas");

  // Alertas silenciados persistidos em localStorage
  const [silencedKeys, setSilencedKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SILENCED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal WhatsApp
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<{ id?: string; project_id?: string; instance_name?: string } | null>(null);

  // Modal Token Meta
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenProjectId, setTokenProjectId] = useState<string>("");

  const { data: room, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["machine-room"],
    queryFn: loadMachineRoom,
    staleTime: 60_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["imphq-projects-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      return (data || []) as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
  });

  const alerts = useMemo(() => (room ? machineAlerts(room) : []), [room]);
  const counts = alertCounts(alerts);

  const silenceAlert = (key: string) => {
    setSilencedKeys((prev) => {
      const next = Array.from(new Set([...prev, key]));
      try {
        localStorage.setItem(STORAGE_SILENCED_KEY, JSON.stringify(next));
      } catch {}
      toast.info("Alerta silenciado");
      return next;
    });
  };

  const unsilenceAlert = (key: string) => {
    setSilencedKeys((prev) => {
      const next = prev.filter((k) => k !== key);
      try {
        localStorage.setItem(STORAGE_SILENCED_KEY, JSON.stringify(next));
      } catch {}
      toast.success("Alerta reativado");
      return next;
    });
  };

  const unsilenceAll = () => {
    setSilencedKeys([]);
    try {
      localStorage.removeItem(STORAGE_SILENCED_KEY);
    } catch {}
    toast.success("Todos os alertas foram reativados");
  };

  // Filtragem de acordo com o escopo (Ativas, Todas, Silenciadas)
  const scopedAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const key = alertKey(a);
      const isSilenced = silencedKeys.includes(key);

      if (scope === "silenciadas") {
        return isSilenced;
      }

      if (isSilenced) return false;

      if (scope === "ativas") {
        // Oculta fontes dormentes/inativas (sem eventos ou dados há muito tempo)
        const isDormant = a.area === "fontes" && (a.titulo.includes("nenhum dado chegando") || a.titulo.includes("tracker sem eventos"));
        if (isDormant) return false;
      }

      return true;
    });
  }, [alerts, silencedKeys, scope]);

  // Aplica filtro por gravidade (tudo, erro, atencao, info)
  const shown = filter === "all" ? scopedAlerts : scopedAlerts.filter((a) => a.severidade === filter);

  const dormantCount = useMemo(() => {
    return alerts.filter((a) => a.area === "fontes" && (a.titulo.includes("nenhum dado chegando") || a.titulo.includes("tracker sem eventos"))).length;
  }, [alerts]);

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sala de máquinas</h1>
          <p className="text-sm text-muted-foreground">
            Saúde das rotinas, fontes de número, credenciais e custos. Ações operacionais diretas para resolver pendências.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Não foi possível ler a sala de máquinas: {error instanceof Error ? error.message : String(error)}
        </p>
      )}

      {room && (
        <>
          {/* Controls Bar: Escopos + Gravidades */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            {/* Escopos de Exibição */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setScope("ativas")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  scope === "ativas"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                Operações Ativas
              </button>
              <button
                type="button"
                onClick={() => setScope("todas")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  scope === "todas"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todas ({alerts.length})
              </button>
              <button
                type="button"
                onClick={() => setScope("silenciadas")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  scope === "silenciadas"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BellOff className="h-3 w-3" />
                Silenciados {silencedKeys.length > 0 ? `(${silencedKeys.length})` : ""}
              </button>
            </div>

            {/* Filtro por Gravidade (mantém role="tab" e labels compatíveis com os testes) */}
            <div className="flex flex-wrap gap-1.5 items-center" role="tablist" aria-label="Filtrar por gravidade">
              {(["all", "erro", "atencao", "info"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={filter === s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filter === s
                      ? "border-primary bg-primary/15 text-primary font-semibold"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "all" ? `Tudo (${alerts.length})` : `${SEVERITY[s].label} (${counts[s]})`}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Status */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Lido em {new Date(room.gerado_em).toLocaleString("pt-BR")} · {room.rotinas.length} rotinas ativas · banco {room.banco?.total_mb ?? "?"} MB
            </span>
            {scope === "silenciadas" && silencedKeys.length > 0 && (
              <Button size="sm" variant="ghost" onClick={unsilenceAll} className="h-6 text-xs text-primary px-2">
                Reativar todos os silenciados
              </Button>
            )}
          </div>

          {/* Alertas */}
          {shown.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ShieldCheck className="h-8 w-8 mx-auto text-emerald-500/80" />
              <p className="text-sm font-medium text-foreground">
                {scope === "silenciadas" ? "Nenhum alerta silenciado no momento." : "Nenhuma pendência encontrada nesta visualização."}
              </p>
              {scope === "ativas" && dormantCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {dormantCount} aviso(s) de projetos dormentes ou sem tráfego foram ocultados.{" "}
                  <button type="button" onClick={() => setScope("todas")} className="text-primary hover:underline">
                    Ver todas as fontes
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((a, i) => {
                const sev = SEVERITY[a.severidade];
                const Icon = sev.icon;
                const key = alertKey(a);
                const isSilenced = silencedKeys.includes(key);

                // Informações extraídas para ações rápidas
                const waInfo = a.area === "whatsapp" ? extractWhatsAppInfoFromAlert(a, projects) : null;
                const adProjectId = a.area === "anuncios" ? extractProjectIdFromAlert(a, projects) : null;
                const isMetaTokenIssue = a.area === "anuncios" && (
                  a.detalhe?.toLowerCase().includes("token") ||
                  a.detalhe?.toLowerCase().includes("expirado") ||
                  a.detalhe?.includes("190")
                );

                return (
                  <Card key={`${a.area}-${i}`} className={cn("border transition-colors", sev.cls)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-label={sev.label} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/60 border border-border/40 text-muted-foreground">
                                {AREA_LABEL[a.area] ?? a.area}
                              </span>
                              {a.titulo}
                            </p>
                            {/* Botão rápido de silenciar */}
                            {isSilenced ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 px-2 shrink-0"
                                onClick={() => unsilenceAlert(key)}
                              >
                                <Bell className="h-3 w-3 mr-1" /> Reativar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2 shrink-0"
                                onClick={() => silenceAlert(key)}
                                title="Silenciar este alerta"
                              >
                                <BellOff className="h-3 w-3 mr-1" /> Silenciar
                              </Button>
                            )}
                          </div>

                          {a.detalhe && (
                            <p className="mt-1 text-xs text-muted-foreground break-words leading-relaxed">
                              {a.detalhe}
                            </p>
                          )}

                          {a.acao && (
                            <p className="mt-1 text-xs text-foreground/80 font-medium">
                              → {a.acao}
                            </p>
                          )}

                          {/* Barra de Ações Operacionais Diretas */}
                          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                            {/* Ações WhatsApp */}
                            {a.area === "whatsapp" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setConnectProvider(waInfo);
                                    setConnectModalOpen(true);
                                  }}
                                >
                                  <Smartphone className="h-3.5 w-3.5" />
                                  Reconectar Chip
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
                                  <a href="/inbox?tab=whatsapp">
                                    <ExternalLink className="h-3 w-3" />
                                    Abrir WhatsApp
                                  </a>
                                </Button>
                              </>
                            )}

                            {/* Ações Anúncios */}
                            {a.area === "anuncios" && (
                              <>
                                {isMetaTokenIssue && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => {
                                      setTokenProjectId(adProjectId || "");
                                      setTokenModalOpen(true);
                                    }}
                                  >
                                    <Key className="h-3.5 w-3.5" />
                                    Renovar Token da Meta
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
                                  <a href="/gerenciador">
                                    <ExternalLink className="h-3 w-3" />
                                    Ver Gerenciador
                                  </a>
                                </Button>
                              </>
                            )}

                            {/* Ações Ações Automáticas */}
                            {a.area === "acoes" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10" asChild>
                                <a href="/aprovar">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                  Fila de Aprovações
                                </a>
                              </Button>
                            )}

                            {/* Ações Webhooks / Fontes */}
                            {(a.area === "webhooks" || a.area === "fontes") && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
                                  <a href="/tracker">
                                    <ExternalLink className="h-3 w-3" />
                                    Ver Tracker
                                  </a>
                                </Button>
                                {a.area === "webhooks" && (
                                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" asChild>
                                    <a href="/plataformas">
                                      <ExternalLink className="h-3 w-3" />
                                      Plataformas
                                    </a>
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Ações Instagram */}
                            {a.area === "instagram" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
                                <a href="/inbox?tab=instagram">
                                  <ExternalLink className="h-3 w-3" />
                                  Ver Instagram
                                </a>
                              </Button>
                            )}

                            {/* Ações Custos */}
                            {a.area === "custo" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
                                <a href="/openrouter-custos">
                                  <ExternalLink className="h-3 w-3" />
                                  Ver Custos de IA
                                </a>
                              </Button>
                            )}

                            {/* Ações Voz */}
                            {a.area === "voz" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
                                <a href="/configuracoes">
                                  <ExternalLink className="h-3 w-3" />
                                  Configurações de Voz
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de Conexão WhatsApp */}
      <ConnectWhatsAppModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        projects={projects}
        provider={connectProvider}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["machine-room"] });
          toast.success("WhatsApp reconectado com sucesso!");
        }}
      />

      {/* Modal de Renovação de Token Meta */}
      <RenovarTokenDialog
        open={tokenModalOpen}
        onOpenChange={setTokenModalOpen}
        defaultProjectId={tokenProjectId}
        projects={projects}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["machine-room"] });
        }}
      />
    </div>
  );
}
