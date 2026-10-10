import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadMarketing } from "@/lib/marketing-load";
import { consolidateAds, consolidateEvents, consolidateSales, coverage } from "@/lib/marketing-consolidation";
import { SeoResearchLog } from "@/components/dashboard/SeoResearchLog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const LABEL = { unavailable: "Fonte indisponível", incomplete: "Leitura incompleta (limite)", missing: "Sem dado", stale: "Fonte defasada", observed: "Observado · cobertura não confirmada", confirmed: "Cobertura confirmada" };
const format = (value: number | null | undefined) => value == null ? "Sem dado" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const timestamp = (value: string | null | undefined) => value ? new Date(value).toLocaleString("pt-BR") : "Não comprovada";

export function MarketingSources({ projectId }: { projectId: string }) {
  const [since, setSince] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0,10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0,10));
  const [source, setSource] = useState("all");
  const [savingReview, setSavingReview] = useState(false);
  const { user } = useAuth();
  const until = new Date(`${end}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 1);
  const valid = !!since && !!end && since <= end && Number.isFinite(until.getTime());
  const startIso = `${since}T00:00:00.000Z`;
  const endIso = valid ? until.toISOString() : "";
  const query = useQuery({ queryKey: ["marketing-sources", projectId, startIso, endIso], enabled: projectId !== "all" && valid, queryFn: () => loadMarketing(projectId, startIso, endIso), staleTime: 60000 });
  const data = query.data;
  const sales = useMemo(() => data ? consolidateSales(data.sales.rows, startIso, endIso) : null, [data, startIso, endIso]);
  const ads = useMemo(() => data ? consolidateAds(data.ads.rows) : [], [data]);
  const events = useMemo(() => data ? consolidateEvents([...data.events.rows, ...data.funnel.rows]) : null, [data]);
  const saveReview = async () => {
    if (!data || !user || !sales || !events) return;
    setSavingReview(true);
    const content = [
      `Revisão semanal de marketing · ${projectId}`,
      `Período UTC: ${since} a ${end}. Leitura do painel: ${new Date(query.dataUpdatedAt).toISOString()}.`,
      `Aquisição: ${data.leads.rows.length || "sem dado"} leads registrados; ${LABEL[coverage({ rows: data.leads.rows.length, error: data.leads.error, truncated: data.leads.truncated })]}.`,
      `Funil observado: ${events.pageSessions} sessões com visualização, ${events.checkoutSessions} com checkout; ${LABEL[coverage({ rows: data.events.rows.length + data.funnel.rows.length, error: data.events.error || data.funnel.error, truncated: data.events.truncated || data.funnel.truncated })]}.`,
      `Checkout: ${LABEL[coverage({ rows: data.sales.rows.length, error: data.sales.error, truncated: data.sales.truncated })]}. Totais por moeda: ${JSON.stringify(sales.totals)}. Sem total identificado não confirma zero.`,
      `Ads (origem/dia/moeda, sem somar fontes): ${JSON.stringify(ads)}.`,
      `Última coleta ads: Zernio ${data.health?.zernio_ultimo_sync ?? "não comprovada"}; Meta ${data.health?.meta_ultimo_sync ?? "não comprovada"}. Tracker/checkout: não comprovada. GA4/GSC: sem ingestão confirmada.`,
      `Lacunas checkout: ${sales.missingIdentity} sem chave, ${sales.fallbackDates} datas fallback, ${sales.unknownCurrency} moedas desconhecidas. CPA/ROAS sem base reconciliada.`,
      "Próximos passos: conferir fontes e cobertura; reconciliar pedidos/moedas; revisar pesquisas SEO e registrar decisão, responsável e resultado no Diário de Bordo."
    ].join("\n");
    const { error } = await supabase.from("imphq_project_notes").insert({ project_id: projectId, author_id: user.id, author_name: "Revisão de marketing", content });
    setSavingReview(false);
    if (error) toast.error("Não foi possível salvar a revisão semanal"); else toast.success("Revisão salva no Diário de Bordo do projeto");
  };
  if (projectId === "all") return <p className="text-xs text-muted-foreground pb-4">Selecione um projeto para reconciliar aquisição, funil, vendas pagas e pesquisas SEO.</p>;
  return <section className="space-y-3 mb-6" aria-label="Consolidação de marketing por fonte">
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">De (UTC)<Input type="date" value={since} onChange={e => setSince(e.target.value)} /></label>
      <label className="text-xs">Até (UTC, inclusive)<Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
      <Select value={source} onValueChange={setSource}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{[["all","Todas as fontes"],["ads","Anúncios"],["tracker","Tracker"],["checkout","Checkout"],["leads","Aquisição / leads"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" disabled={query.isFetching || !valid} onClick={() => query.refetch()}>Atualizar leitura</Button>
    </div>
    {!valid && <p role="alert">Selecione um período válido.</p>}
    {query.isLoading && <p className="text-xs">Lendo fontes do projeto…</p>}
    {query.isError && <p role="alert">Não foi possível ler as fontes. Tente atualizar.</p>}
    {data && <>
      <p className="text-xs text-muted-foreground">Período: {since} a {end} (UTC). Leitura do painel: {new Date(query.dataUpdatedAt).toLocaleString("pt-BR")}. Esta leitura não comprova coleta das integrações.</p>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Fonte / origem</th><th>Cobertura</th><th>Última coleta bem-sucedida</th><th>Resultado observado</th></tr></thead><tbody>
        {(source === "all" || source === "leads") && <tr className="border-t border-border"><td className="py-3">imphq_leads · aquisição registrada</td><td>{LABEL[coverage({ rows: data.leads.rows.length, error: data.leads.error, truncated: data.leads.truncated })]}</td><td>Não comprovada</td><td>{data.leads.rows.length ? `${data.leads.rows.length} leads registrados` : "Sem dado"}</td></tr>}
        {(source === "all" || source === "ads") && (ads.length ? ads : [null]).map((a,i) => {
          const directMeta = a?.source === "meta";
          const lastSuccess = a?.source === "zernio" ? data.health?.zernio_ultimo_sync : directMeta ? data.health?.meta_ultimo_sync : null;
          const syncError = a?.source === "zernio" ? data.health?.zernio_status === "error" : directMeta && data.health?.meta_status === "error";
          return <tr key={i} className="border-t border-border"><td className="py-3">imphq_ads_spend · {a?.source ?? "anúncios"} · {String(a?.day ?? "")} · {String(a?.platform ?? "")}</td><td>{LABEL[coverage({ rows: a?.spend != null ? 1 : 0, error: data.ads.error || syncError, truncated: data.ads.truncated, lastSuccess })]}</td><td>{timestamp(lastSuccess)}</td><td>{a ? `${a.currency}: gasto ${format(a.spend)} · views ${format(a.views)} · checkout ${format(a.checkouts)} · excluídos ${a.excluded}` : "Sem dado"}</td></tr>;
        })}
        {(source === "all" || source === "tracker") && <tr className="border-t border-border"><td className="py-3">imphq_events + imphq_funnel_events</td><td>{LABEL[coverage({ rows: data.events.rows.length + data.funnel.rows.length, error: data.events.error || data.funnel.error, truncated: data.events.truncated || data.funnel.truncated })]}</td><td>Não comprovada</td><td>{events && data.events.rows.length + data.funnel.rows.length > 0 ? `${events.pageSessions} sessões com visualização · ${events.checkoutSessions} sessões com checkout · ${events.excluded} QA excluídos · ${events.missingIdentity} sem sessão` : "Sem dado"}</td></tr>}
        {(source === "all" || source === "checkout") && <tr className="border-t border-border"><td className="py-3">imphq_vendas · webhook do checkout</td><td>{LABEL[coverage({ rows: data.sales.rows.length, error: data.sales.error, truncated: data.sales.truncated })]}</td><td>Não comprovada</td><td>{sales && Object.entries(sales.totals).length ? Object.entries(sales.totals).map(([currency,t]) => <div key={currency}>{currency}: {t.orders} pedidos pagos · bruto {format(t.gross)} · líquido {format(t.net)}</div>) : "Nenhuma venda paga identificada na leitura; zero não confirmado"}</td></tr>}
        <tr className="border-t border-border"><td className="py-3">GA4 / GSC</td><td>Sem ingestão confirmada</td><td>Não comprovada</td><td>Sem dado</td></tr>
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">Valores 0 nas linhas disponíveis são zeros observados; não comprovam cobertura do período. Tracker conta sessões, não pessoas. Meta e Zernio são apresentados separadamente. CPA/ROAS não calculados sem reconciliação e atribuição comprovadas.</p>
      {events && <p className="text-xs text-muted-foreground">Origem tracker: {events.legacyBridges} cópias legacy_events, {events.bridgeDuplicates} removidas pela identidade do evento original. ViewContent e Lead traduzidos pela ponte não comprovam reprodução de vídeo ou quiz. Clique de compra da página e vínculo visitante Ticto ↔ página permanecem sem prova.</p>}
      {sales && <details className="text-xs"><summary>Reconciliação do checkout (amostra sem dados pessoais)</summary><p>{sales.duplicates} componentes duplicados removidos · {sales.missingIdentity} registros sem chave transacional excluídos · {sales.fallbackDates} datas com fallback created_at · {sales.unknownCurrency} componentes com moeda desconhecida. Status atual aplicado antes do período; correções sem versão temporal não permitem reconstruir histórico.</p><pre className="overflow-auto p-2">{JSON.stringify(sales.evidence,null,2)}</pre></details>}
      <p className="text-xs">Revisão semanal: conferir fontes defasadas e cobertura, reconciliar pedidos e moedas, registrar decisão e resultado nas pesquisas abaixo. Métricas manuais permanecem separadas.</p>
      <Button variant="outline" disabled={!user || savingReview || query.isFetching} onClick={saveReview}>Salvar revisão semanal no Diário de Bordo</Button>
    </>}
    <SeoResearchLog key={projectId} projectId={projectId} />
  </section>;
}
