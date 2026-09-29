import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Venda = Pick<Tables<"imphq_vendas">, "id" | "nome" | "valor" | "status" | "created_at" | "plataforma">;

const SUPABASE_PROJECT = "tkbivipqiewkfnhktmqq";
const BASE_URL = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/webhook-pagamento`;

const PLATFORMS = [
  { key: "kiwify", label: "Kiwify", emoji: "🛍️" },
  { key: "hotmart", label: "Hotmart", emoji: "🟡" },
  { key: "ticto", label: "Ticto", emoji: "💜" },
] as const;

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  return `há ${diffD} dia${diffD !== 1 ? "s" : ""}`;
}

function statusInfo(lastVenda: Venda | null): {
  dot: "green" | "yellow" | "red";
  label: string;
} {
  if (!lastVenda?.created_at) return { dot: "red", label: "Sem dados" };
  const diffH = (Date.now() - new Date(lastVenda.created_at).getTime()) / 3_600_000;
  if (diffH <= 24) return { dot: "green", label: "Recebendo" };
  if (diffH <= 168) return { dot: "yellow", label: "Inativo" };
  return { dot: "red", label: "Sem dados" };
}

const dotClass: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-400",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

export function WebhookStatusPanel({ project }: { project: Tables<"imphq_projects"> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loadingVendas, setLoadingVendas] = useState(true);
  const [testing, setTesting] = useState(false);

  const slug = (project as { slug?: string | null }).slug ?? project.id;

  const webhookUrls = PLATFORMS.map((p) => ({
    ...p,
    url: `${BASE_URL}?project_id=${slug}&platform=${p.key}`,
  }));

  useEffect(() => {
    let cancelled = false;
    setLoadingVendas(true);
    supabase
      .from("imphq_vendas")
      .select("id,nome,valor,status,created_at,plataforma")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!cancelled) {
          setVendas(data ?? []);
          setLoadingVendas(false);
        }
      });
    return () => { cancelled = true; };
  }, [project.id]);

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopied(key);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(null), 2000);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("webhook-pagamento", {
        body: {
          project_id: slug,
          platform: "test",
          event: "purchase_approved",
          data: {
            id: "test-" + Date.now(),
            name: "Compra de Teste",
            email: "teste@imperiohq.com",
            amount: 4700,
            status: "aprovado",
          },
        },
      });
      if (error) throw error;
      toast.success("Webhook de teste enviado com sucesso!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar webhook de teste");
    } finally {
      setTesting(false);
    }
  };

  const lastVenda = vendas[0] ?? null;
  const { dot, label: statusLabel } = statusInfo(lastVenda);

  return (
    <Card className="bg-[#0A0B0D] border-[#1B1E23]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wider text-[#D6FF4B] font-sans">
          🔗 Status dos Webhooks de Pagamento
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          URLs exclusivas deste projeto para receber notificações de venda em tempo real
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Section 1: Webhook URLs ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground/80">URLs por plataforma</p>
          {webhookUrls.map((p) => (
            <div
              key={p.key}
              className="flex items-center gap-2 p-2.5 rounded-md bg-[#0F1114] border border-[#1B1E23] group"
            >
              <span className="text-base shrink-0">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-foreground mb-0.5">{p.label}</p>
                <code className="text-[9px] text-muted-foreground break-all leading-tight">
                  {p.url}
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyUrl(p.url, p.key)}
                className="shrink-0 p-1.5 rounded hover:bg-[#1B1E23] text-muted-foreground hover:text-[#D6FF4B] transition-colors"
                title="Copiar URL"
              >
                {copied === p.key ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* ── Section 2: Live Status ── */}
        <div className="border-t border-[#1B1E23] pt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-medium text-foreground/80">Status ao vivo</p>
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${dotClass[dot]} shadow-[0_0_6px_currentColor]`} />
              <Badge
                className={
                  dot === "green"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                    : dot === "yellow"
                    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]"
                    : "bg-red-500/15 text-red-400 border-red-500/30 text-[10px]"
                }
              >
                {statusLabel}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Último webhook:{" "}
              <span className="text-foreground font-medium">
                {lastVenda?.created_at ? formatRelative(lastVenda.created_at) : "Nunca"}
              </span>
            </span>
          </div>

          {/* Last 5 sales table */}
          {loadingVendas ? (
            <p className="text-[10px] text-muted-foreground animate-pulse">Carregando vendas...</p>
          ) : vendas.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[#0F1114] border border-[#1B1E23]">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Nenhuma venda registrada ainda. Configure os webhooks nas plataformas e clique em "Enviar Webhook de Teste" abaixo.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-[#1B1E23] overflow-hidden">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[#0F1114] border-b border-[#1B1E23]">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Nome</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Valor</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {vendas.map((v, i) => (
                    <tr
                      key={v.id}
                      className={`border-b border-[#1B1E23] last:border-0 ${i % 2 === 0 ? "bg-[#0A0B0D]" : "bg-[#0D0E11]"}`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground truncate max-w-[120px]">
                        {v.nome ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[#D6FF4B] font-mono">
                        {v.valor != null
                          ? `R$ ${(v.valor / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${
                            v.status === "aprovado" || v.status === "approved"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : v.status === "reembolsado" || v.status === "refunded"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          {v.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {v.created_at ? formatRelative(v.created_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 3: Test Button ── */}
        <div className="border-t border-[#1B1E23] pt-4 flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            onClick={sendTest}
            disabled={testing}
            className="gap-1.5 text-xs bg-[#D6FF4B] hover:bg-[#c8f040] text-black font-semibold shadow-lg shadow-[#D6FF4B]/10 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {testing ? "Enviando..." : "Enviar Webhook de Teste"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Simula uma compra aprovada de R\$47,00 com plataforma <code className="bg-[#1B1E23] px-1 rounded">test</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
