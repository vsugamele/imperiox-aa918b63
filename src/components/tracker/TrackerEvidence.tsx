import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const count = z.number().int().nonnegative();
const amount = z.number().finite();
const reportSchema = z.object({
  measured_at: z.string(), since: z.string(), until: z.string(),
  quality: z.object({
    events: count, sessions: count, missing_event_ids: count, missing_click_ids: count,
    missing_creative_ids: count, unattributed_sales: count, latest_event_at: z.string().nullable(),
    webhook_failures: count, unprocessed_hw: count,
  }),
  financial: z.array(z.object({
    project_id: z.string().nullable(), currency: z.string().nullable(), ad_id: z.string().nullable(),
    gross: amount.nullable(), net: amount.nullable(), unknown_net: count, approved_sales: count,
    refunds: count, refunded_net: amount.nullable(), spend: amount.nullable(),
    profit_after_media: amount.nullable(), attributed_sales: count,
  })),
  vsl: z.array(z.object({
    project_id: z.string().nullable(), player_id: z.string().nullable(), views: count,
    instrumented_sessions: count.optional(),
    plays: count.nullable(), pitch: count.nullable(), reached_25: count.nullable(), reached_50: count.nullable(),
    reached_75: count.nullable(), reached_90: count.nullable(),
  })),
});
type TrackerReport = z.infer<typeof reportSchema>;

// SQL accepts null for all projects; generated RPC types cannot express nullable arguments.
const reportClient = supabase as unknown as {
  rpc(name: "imphq_tracker_report", args: {
    p_project_id: string | null; p_since: string; p_until: string;
  }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

interface TrackerEvidenceProps {
  projectId: string | null;
  since: string;
  until: string;
  projects?: { id: string; name: string }[];
}

function money(value: number | null, currency: string | null) {
  if (value === null || currency === null) return "Indisponível";
  const formatted = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "UNKNOWN" ? `${formatted} (moeda desconhecida)` : `${currency} ${formatted}`;
}

function timestamp(value: string | null) {
  if (value === null) return "Sem registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function TrackerEvidence({ projectId, since, until, projects = [] }: TrackerEvidenceProps) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([projectId === "all" ? null : projectId, since, until, attempt]);
  const [state, setState] = useState<{ key: string; report: TrackerReport | null; error: string | null }>({
    key: "", report: null, error: null,
  });
  useEffect(() => {
    let cancelled = false;
    setState({ key, report: null, error: null });
    void (async () => {
      try {
        const { data, error } = await reportClient.rpc("imphq_tracker_report", {
          p_project_id: projectId === "all" ? null : projectId, p_since: since, p_until: until,
        });
        if (error) throw new Error(error.message);
        const report = reportSchema.parse(data);
        if (!cancelled) setState({ key, report, error: null });
      } catch (error) {
        if (!cancelled) setState({ key, report: null, error:
          error instanceof z.ZodError ? "Resposta do relatório inválida"
            : error instanceof Error ? error.message : "Falha ao carregar relatório",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, since, until, key]);

  const current = state.key === key ? state : { report: null, error: null };
  const report = current.report;
  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name || id || "Sem projeto";
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Receita por moeda e evidências do tracker</h2>
          <p className="text-xs text-muted-foreground">Escopo: projeto e período selecionados. Plataforma e produto não filtram este relatório.</p>
        </div>
        {current.error ? (
          <div role="alert" className="text-sm text-destructive space-y-2">
            <p>Relatório indisponível: {current.error}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</Button>
          </div>
        ) : !report ? <p role="status" className="text-sm text-muted-foreground">Carregando evidências do tracker…</p> : (
          <>
            <p className="text-xs text-muted-foreground">Medido em {timestamp(report.measured_at)} · Período BRT: {timestamp(report.since)} → {timestamp(report.until)} (fim exclusivo)</p>
            <section aria-label="Qualidade dos dados" className="space-y-2">
              <h3 className="text-sm font-medium">Qualidade dos dados</h3>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {([
                  ["Eventos", report.quality.events], ["Sessões", report.quality.sessions],
                  ["Eventos sem ID de evento", report.quality.missing_event_ids],
                  ["Eventos sem ID de clique", report.quality.missing_click_ids],
                  ["Eventos sem ID de criativo", report.quality.missing_creative_ids],
                  ["Vendas sem atribuição", report.quality.unattributed_sales],
                  ["Falhas de webhook", report.quality.webhook_failures],
                  ["Webhooks H&W não processados", report.quality.unprocessed_hw],
                ] as const).map(([label, value]) => <div key={label} className="rounded border border-border p-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}
              </dl>
              <p className="text-xs text-muted-foreground">Último evento: {timestamp(report.quality.latest_event_at)}</p>
            </section>
            <section aria-label="Receita por criativo e moeda" className="space-y-2">
              <h3 className="text-sm font-medium">Receita por criativo e moeda</h3>
              <p className="text-xs text-muted-foreground">Valores mantidos na moeda de origem. Líquido desconhecido e mídia ausente ou incompatível ficam indisponíveis.</p>
              {report.financial.length === 0 ? <p className="text-sm text-muted-foreground">Sem registros financeiros no período.</p> : (
                <Table className="text-xs">
                  <TableHeader><TableRow>{["Projeto", "Criativo (ID)", "Moeda", "Bruto", "Líquido", "Vendas com líquido desconhecido", "Aprovações", "Reembolsos", "Líquido reembolsado", "Mídia", "Resultado após mídia", "Vendas atribuídas"].map(label => <TableHead key={label} className="whitespace-nowrap">{label}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>{report.financial.map((row, index) => (
                    <TableRow key={JSON.stringify([row.project_id, row.currency, row.ad_id, index])}>
                      <TableCell>{projectName(row.project_id)}</TableCell><TableCell>{!row.ad_id || row.ad_id === "unattributed" ? "Sem criativo atribuído" : row.ad_id}</TableCell><TableCell>{row.currency === "UNKNOWN" ? "Moeda desconhecida" : row.currency || "Moeda indisponível"}</TableCell>
                      <TableCell className="whitespace-nowrap">{money(row.gross, row.currency)}</TableCell><TableCell className="whitespace-nowrap">{money(row.net, row.currency)}</TableCell>
                      <TableCell>{row.unknown_net}</TableCell><TableCell>{row.approved_sales}</TableCell><TableCell>{row.refunds}</TableCell>
                      <TableCell className="whitespace-nowrap">{money(row.refunded_net, row.currency)}</TableCell><TableCell className="whitespace-nowrap">{money(row.spend, row.currency)}</TableCell>
                      <TableCell className="whitespace-nowrap">{money(row.profit_after_media, row.currency)}</TableCell><TableCell>{row.attributed_sales}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </section>
            <section aria-label="Sessões VSL por player" className="space-y-2">
              <h3 className="text-sm font-medium">Sessões VSL por player</h3>
              <p className="text-xs text-muted-foreground">Visualizaram inclui sessões antigas e novas. Sessões instrumentadas conta as sessões com confirmação da nova medição.</p>
              <p className="text-xs text-muted-foreground">Reprodução, pitch e retenção dependem dos marcos configurados e podem cobrir apenas parte do histórico do player. Para interpretar esses marcos, use a cobertura de sessões instrumentadas como base, em vez de todas as visualizações.</p>
              <p className="text-xs text-muted-foreground">Não medido: a fonte não fornece esse marco. Zero: fonte medida sem sessões nesse marco.</p>
              {report.vsl.length === 0 ? <p className="text-sm text-muted-foreground">Sem registros VSL no período.</p> : (
                <Table className="text-xs">
                  <TableHeader><TableRow>{["Projeto", "Player (ID)", "Visualizaram", "Sessões instrumentadas", "Iniciaram reprodução", "Alcançaram o pitch", "Alcançaram 25%", "Alcançaram 50%", "Alcançaram 75%", "Alcançaram 90%"].map(label => <TableHead key={label} className="whitespace-nowrap">{label}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>{report.vsl.map((row, index) => <TableRow key={JSON.stringify([row.project_id, row.player_id, index])}>
                    <TableCell>{projectName(row.project_id)}</TableCell><TableCell>{row.player_id || "Player não identificado"}</TableCell>
                    {[row.views, row.instrumented_sessions, row.plays, row.pitch, row.reached_25, row.reached_50, row.reached_75, row.reached_90].map((value, i) => <TableCell key={i}>{value === null || value === undefined ? "Não medido" : value}</TableCell>)}
                  </TableRow>)}</TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
