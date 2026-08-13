import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Clock3, LifeBuoy, Loader2, MessageCircle, MousePointerClick, RefreshCw, Stethoscope, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

type DashboardTotals = {
  sessions: number;
  quiz: number;
  quiz_completed: number;
  queue: number;
  consult: number;
  offer: number;
  checkout_clicked: number;
  hot: number;
};

type DashboardLead = {
  id: string;
  public_token?: string;
  lead_id?: string | null;
  name: string;
  contact: string;
  score: number;
  stage: string;
  status: string;
  script_step: number;
  checkout_clicked_at?: string | null;
  concern: string;
  timeline?: string;
  tried?: string;
  updated_at: string;
  recovery_bucket?: string;
  quiz_step_label?: string;
};

type RecoveryBucket = {
  bucket: string;
  count: number;
  sessions: DashboardLead[];
};

const bucketCopy: Record<string, { title: string; action: string; tone: string }> = {
  quiz_paused: {
    title: "Quiz pausado",
    action: "Retomar pela ultima pergunta confirmada, sem pedir tudo outra vez.",
    tone: "Primeiro gargalo",
  },
  intake_started: {
    title: "Intake iniciado",
    action: "Perguntar se quer continuar a avaliacao privada.",
    tone: "Baixa intencao",
  },
  queue_abandoned: {
    title: "Saiu na fila",
    action: "Avisar que o atendimento privado esta pronto.",
    tone: "Recuperacao rapida",
  },
  consult_abandoned: {
    title: "Saiu na consulta",
    action: "Retomar pelo ponto que ela contou, sem reiniciar.",
    tone: "Contexto salvo",
  },
  objection_or_late_consult: {
    title: "Objeção sem fechamento",
    action: "Responder ceticismo, preco ou ingredientes e pedir decisao.",
    tone: "Alta intencao",
  },
  offer_no_click: {
    title: "Oferta vista, sem clique",
    action: "Reforcar recomendacao personalizada e CTA de 30 dias.",
    tone: "Prioridade",
  },
  checkout_clicked: {
    title: "Checkout clicado",
    action: "Acompanhar compra ou duvida de checkout.",
    tone: "Quase venda",
  },
};

const careOpenFlowPath = "/openflow?automacao=2266ddbd-cdd0-41b4-acae-428da8f324f6";

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function followUpCopy(lead: DashboardLead) {
  if (lead.recovery_bucket === "quiz_paused") {
    return `${lead.name}, your private LinfaFlow review is saved. You can continue from the question you were answering, without starting again.`;
  }
  if (lead.recovery_bucket === "offer_no_click") {
    return `${lead.name}, based on what you shared, the simplest first step is still the 30-day LinfaFlow routine. Want me to send the secure checkout again?`;
  }
  if (lead.recovery_bucket === "objection_or_late_consult") {
    return `${lead.name}, I reviewed your answers. Since you already tried ${lead.tried || "a few things"}, the point is not another complicated routine. The next step is a simple 30-day test.`;
  }
  if (lead.recovery_bucket === "consult_abandoned") {
    return `${lead.name}, your private LinfaFlow guidance is still open. I can continue from where you stopped instead of starting over.`;
  }
  return `${lead.name}, your private LinfaFlow support room is ready whenever you want to continue.`;
}

export default function LinfaFlowCareDashboard() {
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [recovery, setRecovery] = useState<RecoveryBucket[]>([]);
  const [latest, setLatest] = useState<DashboardLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const checkoutRate = useMemo(() => percent(totals?.checkout_clicked || 0, totals?.sessions || 0), [totals]);
  const offerRate = useMemo(() => percent(totals?.offer || 0, totals?.sessions || 0), [totals]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("linfaflow-care-dashboard");
      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(data?.error || "Dashboard unavailable");
      setTotals(data.totals);
      setRecovery(data.recovery || []);
      setLatest(data.latest || []);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-[#f6fbf8] p-4 text-slate-950 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-emerald-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Stethoscope className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.22em]">LinfaFlow Care Conversion</span>
            </div>
            <h1 className="mt-3 font-display text-4xl italic text-slate-950">Leads por etapa e recuperação</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Painel interno para enxergar onde o script único está convertendo, onde está travando e qual continuação usar sem quebrar a linha principal do atendimento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50">
              <a href={careOpenFlowPath} target="_blank" rel="noopener noreferrer">
                <Workflow className="h-4 w-4" />
                Ver fluxo no OpenFlow
              </a>
            </Button>
            <Button variant="outline" className="border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50" onClick={loadDashboard} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
              <a href="/linfaflow-care" target="_blank" rel="noopener noreferrer">
                Abrir página pública
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Sessões", value: totals?.sessions || 0, icon: MessageCircle },
              { label: "Quiz pausado", value: totals?.quiz || 0, icon: ClipboardCheck },
              { label: "Quiz concluído", value: totals?.quiz_completed || 0, icon: CheckCircle2 },
              { label: "Leads quentes", value: totals?.hot || 0, icon: BarChart3 },
              { label: "Oferta vista", value: totals?.offer || 0, icon: CheckCircle2 },
            { label: "Checkout clicado", value: totals?.checkout_clicked || 0, icon: MousePointerClick },
            { label: "Taxa de clique", value: `${checkoutRate}%`, icon: ArrowRight },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">{item.label}</p>
                <item.icon className="h-4 w-4 text-emerald-700" />
              </div>
              <p className="mt-3 font-display text-3xl text-slate-950">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Funil atual</p>
              <h2 className="mt-1 font-display text-2xl italic">Da fila ao checkout</h2>
            </div>
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">
              Oferta vista: {offerRate}%
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              { label: "Quiz concluído", value: totals?.quiz_completed || 0 },
              { label: "Fila", value: totals?.queue || 0 },
              { label: "Consulta", value: totals?.consult || 0 },
              { label: "Oferta", value: totals?.offer || 0 },
              { label: "Checkout", value: totals?.checkout_clicked || 0 },
            ].map((step) => (
              <div key={step.label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{step.label}</span>
                  <span className="text-slate-500">{step.value}</span>
                </div>
                <Progress value={percent(step.value, totals?.sessions || 0)} className="mt-3" />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <LifeBuoy className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em]">Continuação por etapa</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {recovery.map((bucket) => {
                const copy = bucketCopy[bucket.bucket] || bucketCopy.intake_started;
                return (
                  <div key={bucket.bucket} className="rounded-md border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-emerald-950">{copy.title}</p>
                        <p className="mt-1 text-xs text-emerald-700">{copy.tone}</p>
                      </div>
                      <span className="font-display text-2xl text-emerald-950">{bucket.count}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{copy.action}</p>
                    {bucket.sessions[0] && (
                      <div className="mt-3 rounded-md border border-emerald-100 bg-white p-3 text-xs leading-relaxed text-slate-600">
                        <p className="font-medium text-slate-800">Mensagem sugerida</p>
                        <p className="mt-1">{followUpCopy(bucket.sessions[0])}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <Clock3 className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em]">Leads recentes</p>
            </div>
            <div className="mt-4 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  Carregando leads...
                </div>
              )}
              {!loading && latest.length === 0 && (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
                  Nenhuma sessão registrada ainda.
                </div>
              )}
              {latest.map((lead) => (
                <div key={lead.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{lead.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{lead.contact} · {formatDate(lead.updated_at)}</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-800">
                      {lead.score}%
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">{lead.concern || "Sem dor registrada."}</p>
                  {lead.quiz_step_label && (
                    <p className="mt-2 text-xs font-medium text-amber-800">Parou em: {lead.quiz_step_label}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    <span className="rounded bg-white px-2 py-1">stage: {lead.stage}</span>
                    <span className="rounded bg-white px-2 py-1">step: {lead.script_step}</span>
                    <span className="rounded bg-white px-2 py-1">{lead.recovery_bucket}</span>
                    {lead.lead_id && (
                      <a className="rounded bg-white px-2 py-1 text-emerald-700 hover:text-emerald-900" href={`/leads?lead=${lead.lead_id}`}>
                        CRM: {lead.lead_id.slice(0, 8)}
                      </a>
                    )}
                    {lead.public_token && (
                      <a
                        className="rounded bg-white px-2 py-1 text-emerald-700 hover:text-emerald-900"
                        href={`/linfaflow-care?resume=${encodeURIComponent(lead.public_token)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir retomada
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
