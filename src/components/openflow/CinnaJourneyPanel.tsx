import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsonFields } from "@/lib/json-fields";
import { journeyMetrics, journeyStatusLabels, safeJourneyMedia, type JourneyConversation } from "@/lib/cinna-shield-x1/journey";
import { loadCinnaJourney, loadJourneyMessages, MESSAGE_PAGE_SIZE, type JourneyData, type JourneyMessage } from "@/lib/cinna-shield-x1/journey-data";

interface CinnaJourneyPanelProps { open: boolean; onOpenChange: (open: boolean) => void; }
const formatDate = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("pt-BR") : "Data indisponível";
const turnLabels: Record<string, string> = { advance: "Avançou", hold: "Continuou esclarecendo", human: "Encaminhado", stop: "Pediu para parar", checkout: "Link enviado", complete: "Concluiu" };

export function CinnaJourneyPanel({ open, onOpenChange }: CinnaJourneyPanelProps) {
  const [days, setDays] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<JourneyConversation | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null); setSelected(null); setPage(0); setVersion("");
    loadCinnaJourney(days, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar o histórico. Confira sua sessão e tente atualizar."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, days, refresh]);
  const versions = useMemo(() => [...new Set(data?.conversations.map(item => item.version) || [])], [data]);
  const conversations = useMemo(() => (data?.conversations || []).filter(item => !version || item.version === version), [data, version]);
  const metrics = useMemo(() => journeyMetrics(conversations), [conversations]);
  const name = (item: JourneyConversation) => data?.identities[item.sessionId || ""]?.name || `Lead ${(item.leadId || item.sessionId || item.id).slice(0, 8)}`;
  const needle = search.toLocaleLowerCase().trim();
  const filtered = conversations.filter(item => !needle || [name(item), item.leadId, item.sessionId, item.id].some(value => value?.toLocaleLowerCase().includes(needle)));
  const visible = filtered.slice(page * 25, (page + 1) * 25);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto bg-slate-950 text-slate-100">
      <SheetHeader><SheetTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Etapas e histórico · Cinna Shield</SheetTitle><SheetDescription>Métricas das conversas e histórico salvo de cada lead.</SheetDescription></SheetHeader>
      {selected ? <div className="mt-4"><Button variant="outline" size="sm" onClick={() => setSelected(null)}><ChevronLeft className="h-4 w-4" /> Voltar às métricas</Button>
        <JourneyDetail key={selected.id} conversation={selected} name={name(selected)} channel={data?.identities[selected.sessionId || ""]?.channel || ""} /></div>
        : <div className="space-y-5 mt-5">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-xs">Conversas iniciadas <select aria-label="Período das conversas" value={days} onChange={event => setDays(Number(event.target.value))} className="bg-slate-900 border rounded p-2 ml-2">
              <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={0}>Todo o histórico</option>
            </select></label>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</Button>
            {versions.length > 1 && <select aria-label="Versão do roteiro" className="bg-slate-900 border rounded p-2 text-xs" value={version} onChange={event => { setVersion(event.target.value); setPage(0); }}><option value="">Todas as versões (separadas)</option>{versions.map(value => <option key={value}>{value}</option>)}</select>}
          </div>
          {loading && <p role="status" className="flex gap-2 text-sm"><Loader2 className="animate-spin h-4 w-4" /> Carregando registros…</p>}
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          {data && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Metric label="Conversas" value={conversations.length} />
              <Metric label="Aguardando resposta" value={conversations.filter(item => item.status === "waiting").length} />
              <Metric label="Encaminhadas" value={conversations.filter(item => item.status === "human").length} />
              <Metric label="Links de compra enviados" value={conversations.filter(item => item.status === "checkout").length} />
            </div>
            <p className="text-xs text-slate-400">Uma execução conta como uma conversa; retornos do mesmo lead podem contar novamente. Link enviado não significa compra. Atualizado em {formatDate(data.until)}.</p>
            {data.total > data.loaded && <p role="alert" className="text-amber-300 text-sm">Amostra: {data.loaded} de {data.total} execuções. As métricas cobrem apenas as mais recentes. Reduza o período para obter cobertura completa.</p>}
            {data.unrecognized > 0 && <p className="text-amber-300 text-sm">{data.unrecognized} registros sem snapshot reconhecido ficaram fora das métricas; não foram reconstruídos pelo roteiro atual.</p>}
            {metrics.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-xs text-left"><caption className="text-left mb-3 text-base font-semibold">Desempenho por etapa</caption>
              <thead><tr className="text-slate-400 border-b border-slate-700">{["Etapa", "Chegaram", "Responderam", "Avançaram", "Avanço / alcance", "Esperando", "Encaminhadas", "Pararam", "Dúvidas tratadas"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
              <tbody>{metrics.map(item => <tr key={item.key} className="border-b border-slate-800"><td className="p-2 min-w-40">{item.index + 1}. {item.title}<span className="block text-[10px] text-slate-500">{item.version}</span></td><td className="p-2">{item.reached}</td><td className="p-2">{item.responded}</td><td className="p-2">{item.advanced}</td><td className="p-2">{item.reached ? `${Math.round(item.advanced / item.reached * 100)}%` : "—"}</td><td className="p-2">{item.waiting}</td><td className="p-2">{item.human}</td><td className="p-2">{item.stopped}</td><td className="p-2">{item.holds}</td></tr>)}</tbody>
            </table></div> : <p className="rounded border border-slate-800 p-5 text-sm">Nenhuma conversa registrada neste período. As métricas aparecerão quando o fluxo atender leads.</p>}
            <p className="text-xs text-slate-400">Chegaram = etapa com registro de envio confirmado ou resposta processada, não confirmação de leitura. Responderam = conversas com resposta processada; envios pendentes de confirmação ficam fora dessa contagem. Avançaram = política liberou a próxima etapa; a entrega dela é contabilizada separadamente. Esperando não é abandono. Respostas e decisões detalhadas passam a ser registradas nesta atualização; registros antigos podem não conter esses eventos. Na última etapa, consulte o status de link enviado no histórico.</p>
            <div className="space-y-3"><h3 className="font-semibold">Histórico por lead</h3><Input aria-label="Buscar lead no histórico" placeholder="Buscar nome ou ID do lead/conversa" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
              {visible.map(item => <button key={item.id} onClick={() => setSelected(item)} className="w-full text-left border border-slate-800 hover:border-amber-600 rounded-lg p-3 space-y-1">
                <div className="flex justify-between gap-2 text-sm"><strong>{name(item)}</strong><span>{journeyStatusLabels[item.status] || item.status}</span></div>
                <p className="text-xs text-amber-300">Até: {item.stageTitle}</p><p className="text-xs text-slate-400">Início {formatDate(item.createdAt)} · Atualização {formatDate(item.updatedAt)} · {data.identities[item.sessionId || ""]?.channel || "Canal não informado"}</p>
              </button>)}
              {!visible.length && <p className="text-sm text-slate-400">Nenhum lead encontrado.</p>}
              <div className="flex gap-3 items-center text-xs"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</Button><span>{filtered.length ? page * 25 + 1 : 0}–{Math.min((page + 1) * 25, filtered.length)} de {filtered.length}</span><Button variant="outline" size="sm" disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>
            </div>
          </>}
        </div>}
    </SheetContent>
  </Sheet>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded border border-slate-800 p-3"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-slate-400">{label}</p></div>; }

function JourneyDetail({ conversation, name, channel }: { conversation: JourneyConversation; name: string; channel: string }) {
  const [offset, setOffset] = useState(0);
  const [messages, setMessages] = useState<JourneyMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [until] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (!conversation.sessionId) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setMessages([]);
    loadJourneyMessages(conversation.sessionId, offset, until, controller.signal).then(result => { if (!controller.signal.aborted) { setMessages(result.messages); setTotal(result.total); } })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar as mensagens."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [conversation.sessionId, offset, until, retry]);
  const turns = new Map(conversation.turns.map(turn => [turn.id, turn]));
  return <div className="mt-4 space-y-5">
    <div><h3 className="font-semibold text-lg">{name}</h3><p className="text-sm text-amber-300">{journeyStatusLabels[conversation.status] || conversation.status} · Até: {conversation.stageTitle}</p><p className="text-xs text-slate-400">{channel} · {conversation.version} · Início {formatDate(conversation.createdAt)}</p></div>
    <div><h4 className="font-semibold mb-2">Caminho percorrido</h4><ol className="space-y-2">{conversation.stages.map(stage => <li key={stage.id} className={`text-xs rounded border p-2 ${stage.reached ? "border-emerald-800" : "border-slate-800 text-slate-500"}`}>
      <strong>{stage.index + 1}. {stage.title}</strong> · {stage.reached ? "Alcançada" : "Sem registro de chegada"}{stage.enteredAt && ` · ${formatDate(stage.enteredAt)}`}
      {stage.responded && " · Respondeu"}{stage.advanced && " · Avançou"}{stage.waiting && " · Aguardando resposta"}{stage.checkout && " · Link enviado"}
      {conversation.turns.filter(turn => turn.stageId === stage.id).map(turn => <p key={turn.id} className="mt-1 text-slate-400">{formatDate(turn.at)} · {turnLabels[turn.action] || turn.action}</p>)}
    </li>)}</ol></div>
    <div><h4 className="font-semibold">Mensagens do canal</h4><p className="text-xs text-slate-400 mb-3">Histórico salvo da sessão, incluindo mensagens fora desta execução. Etapas identificadas nas respostas processadas a partir desta atualização.</p>
      {!conversation.sessionId && <p className="text-sm">Esta execução não possui sessão de canal vinculada.</p>}
      {loading && <p role="status">Carregando mensagens…</p>}
      {error && <p role="alert">{error} <Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></p>}
      {!loading && !error && conversation.sessionId && !messages.length && <p className="text-sm text-slate-400">Nenhuma mensagem salva nesta página.</p>}
      <div className="space-y-3">{messages.map(message => {
        const media = safeJourneyMedia(message.media_url);
        const turn = turns.get(message.id);
        const stage = turn && conversation.stages.find(item => item.id === turn.stageId);
        return <article key={message.id} className={`rounded-lg p-3 max-w-[95%] border border-slate-800 ${message.direction === "in" ? "bg-slate-900 mr-8" : "bg-emerald-950/40 ml-8"}`}>
          <p className="text-xs font-semibold mb-1">{message.direction === "in" ? name : "Atendimento"} · {formatDate(message.created_at)}</p>
          {stage && <p className="text-[10px] text-amber-300 mb-1">{stage.title} · {turnLabels[turn.action] || turn.action}</p>}
          {message.texto && <p className="text-sm whitespace-pre-wrap break-words">{message.texto}</p>}
          {media && (/\.(mp3|wav|ogg|m4a)(?:\?|$)/i.test(media) ? <audio controls preload="none" src={media} className="max-w-full mt-2" /> : /\.(png|jpg|jpeg|webp|gif)(?:\?|$)/i.test(media) ? <img src={media} alt="Imagem enviada na conversa" loading="lazy" className="max-h-72 max-w-full rounded mt-2" /> : <a href={media} target="_blank" rel="noopener noreferrer" className="underline text-sm">Abrir mídia enviada</a>)}
          {jsonFields(message.meta).error != null && <p className="text-rose-300 text-xs">Envio não confirmado.</p>}
        </article>;
      })}</div>
      {conversation.sessionId && <div className="flex items-center gap-2 mt-3 text-xs"><Button variant="outline" size="sm" disabled={loading || offset + MESSAGE_PAGE_SIZE >= total} onClick={() => setOffset(value => value + MESSAGE_PAGE_SIZE)}>Mensagens anteriores</Button><span>{messages.length} de {total}</span><Button variant="outline" size="sm" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - MESSAGE_PAGE_SIZE))}>Mais recentes</Button></div>}
    </div>
  </div>;
}
