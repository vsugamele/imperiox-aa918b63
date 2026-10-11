import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Monitor, Send, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { OfficeMap } from '@/components/office/OfficeMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { readOffice, sendOfficeCommand, type OfficeAgent, type OfficeAnswer, type OfficeDecision, type OfficeDevice } from '@/lib/office-command';

const STATUS: Record<string,string> = { working: 'Trabalhando', waiting: 'Precisa de você', idle: 'Disponível', shell: 'Processo em execução' };
const COMMAND: Record<string,string> = { queued: 'Aguardando entrega', dispatching: 'Enviando', delivered: 'Entregue', failed: 'Não entregue', expired: 'Expirou', unknown: 'Sem confirmação — confira a sessão antes de reenviar' };

interface AgentCommandProps { agent: OfficeAgent; device: OfficeDevice; online: boolean; refresh: () => void }
function AgentCommand({ agent, device, online, refresh }: AgentCommandProps) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Record<number, number[]>>({});
  const [others, setOthers] = useState<Record<number, string>>({});
  const [review, setReview] = useState(false);
  const p = agent.permission;
  useEffect(() => { setChoices({}); setOthers({}); setReview(false); }, [p?.id]);
  async function submit(kind: 'message'|'decision', payload: {text:string}|{permissionId:string;decision:OfficeDecision}) {
    setBusy(true);
    try {
      await sendOfficeCommand(device, agent, kind, payload);
      toast.success('Envio registrado. Acompanhe a confirmação abaixo.');
      if (kind === 'message') setMessage('');
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha no envio. Confira o histórico antes de reenviar.'); }
    finally { setBusy(false); }
  }
  const blocked = !online || busy;
  const latest = device.commands.find(c => c.agent_id === agent.id);
  const pendingCommand = latest && ['queued','dispatching'].includes(latest.status);
  const answerReady = p?.questions.every(q => {
    const n = (choices[q.index] || []).length + Number(!!others[q.index]?.trim());
    return q.multiSelect ? n > 0 : n === 1;
  });
  return <article className="rounded-xl border border-border bg-card p-4 space-y-4 min-w-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="font-semibold">{agent.name} <span className="text-xs text-muted-foreground">{agent.provider === 'codex' ? 'Codex' : 'Claude'}</span></h3>
        <p className="text-sm text-primary">{STATUS[agent.status] || agent.status}</p></div>
      <Monitor className="h-5 w-5 shrink-0 text-muted-foreground" />
    </div>
    <p className="text-sm break-words">{agent.activity || agent.title || 'Aguardando próxima atividade'}</p>
    {agent.waitingFor && <p className="text-sm text-amber-400">{agent.waitingFor}</p>}
    {agent.tasks.filter(t => t.status === 'in_progress').map(t => <p key={t.title} className="text-xs text-muted-foreground break-words">Tarefa: {t.title}</p>)}
    {p && <section aria-label={`Pendência de ${agent.name}`} className="rounded-lg border border-amber-500/40 p-3 space-y-3">
      <h4 className="font-medium text-sm">{p.title}</h4>
      {p.input && <details><summary className="cursor-pointer text-sm text-primary">Ver o que será executado</summary><pre className="whitespace-pre-wrap break-all text-xs mt-2 max-h-72 overflow-auto">{p.input}</pre></details>}
      {p.questions.map(q => <fieldset key={q.index} className="space-y-2">
        <legend className="text-sm mb-2">{q.question}</legend>
        {q.options.map(o => <label key={o.index} className="flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer">
          <input type={q.multiSelect ? 'checkbox' : 'radio'} name={`${p.id}-${q.index}`} disabled={blocked || !!pendingCommand}
            checked={(choices[q.index] || []).includes(o.index)} className="mt-1"
            onChange={() => { setChoices(current => ({ ...current, [q.index]: q.multiSelect ? (current[q.index] || []).includes(o.index) ? current[q.index].filter(i => i !== o.index) : [...(current[q.index] || []), o.index] : [o.index] })); if (!q.multiSelect) setOthers(current => ({...current,[q.index]:''})); }} />
          <span>{o.label}{o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}</span>
        </label>)}
        <Textarea aria-label={`Outra resposta: ${q.question}`} placeholder="Ou escreva sua resposta" value={others[q.index] || ''} maxLength={2000} disabled={blocked || !!pendingCommand}
          onChange={e => { setOthers(current => ({...current,[q.index]:e.target.value})); if (!q.multiSelect) setChoices(current => ({...current,[q.index]:[]})); }} />
      </fieldset>)}
      {p.questions.length > 0 ? <Button className="w-full min-h-11" disabled={blocked || !!pendingCommand || !answerReady} onClick={() => {
        const answers: OfficeAnswer[] = p.questions.map(q => ({ question:q.index, options:choices[q.index] || [], other:others[q.index]?.trim() || undefined }));
        void submit('decision',{permissionId:p.id,decision:{behavior:'answer',answers}});
      }}>Responder pendência</Button> : <>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} />Revisei esta ação e seus detalhes</label>
        <div className="flex flex-wrap gap-2"><Button disabled={blocked || !!pendingCommand || !review} onClick={() => void submit('decision',{permissionId:p.id,decision:{behavior:'allow'}})}>Aprovar esta vez</Button>
          <Button variant="destructive" disabled={blocked || !!pendingCommand} onClick={() => void submit('decision',{permissionId:p.id,decision:{behavior:'deny'}})}>Recusar</Button></div>
      </>}
      <p className="text-xs text-muted-foreground">A pendência pode expirar ou ser resolvida no computador.</p>
    </section>}
    {agent.canMessage ? <div className="space-y-2">
      <Textarea aria-label={`Instrução para ${agent.name}`} placeholder="Escreva uma instrução para este agente…" value={message} maxLength={4000} disabled={blocked || !!pendingCommand} onChange={e => setMessage(e.target.value)} />
      <Button className="w-full min-h-11" disabled={blocked || !!pendingCommand || !message.trim()} onClick={() => void submit('message',{text:message.trim()})}><Send className="h-4 w-4 mr-2" />Mandar instrução</Button>
    </div> : <p className="text-xs text-muted-foreground">Mensagens indisponíveis nesta sessão.</p>}
    {latest && <p role="status" className="text-xs break-words text-muted-foreground">{COMMAND[latest.status] || latest.status}{latest.result?.message && ` · ${latest.result.message}`}</p>}
  </article>;
}

export default function Escritorio() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey:['office-command'], queryFn:readOffice, enabled:isAdmin, refetchInterval:4000, retry:1 });
  const [business, setBusiness] = useState('imperio');
  const [selected, setSelected] = useState<{deviceId:string;agentId:string;sessionId:string} | null>(null);
  const mobile = useIsMobile();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const devices = query.data?.devices || [];
  // A stale cached heartbeat must never leave command controls enabled.
  const fresh = !query.isError && now - query.dataUpdatedAt < 12000;
  const selectedDevice = devices.find(d=>d.id===selected?.deviceId);
  const selectedAgent = selectedDevice?.snapshot.agents.find(a=>a.id===selected?.agentId && a.sessionId===selected?.sessionId);
  return <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
    <header className="space-y-2"><div className="flex items-center gap-2"><Building2 className="text-primary h-6 w-6" /><h1 className="text-2xl font-bold">Escritório</h1></div>
      <p className="text-sm text-muted-foreground">Seu escritório ao vivo. Escolha uma sala e toque em quem está trabalhando.</p></header>
    {!isAdmin ? <p>Acesso reservado ao proprietário autorizado do computador.</p> : <>
      {query.isPending && <p role="status">Conectando ao escritório…</p>}
      {query.isError && <div role="alert" className="rounded-lg border border-destructive p-4">Não foi possível atualizar o escritório. Os comandos estão bloqueados.<Button variant="link" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
      {!query.isPending && !query.isError && !devices.length && <p>Nenhum computador conectado à sua conta.</p>}
      {devices.map(device => {
        const online = device.online && fresh;
        return <section key={device.id} className="space-y-5">
          <div className="flex items-center gap-2 text-sm">{online ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-amber-400" />}<strong>{device.name}</strong><span>{online?'Conectado':'Computador desconectado'}</span></div>
          {!online && <p className="text-sm text-amber-400">Mostrando a última atualização. Novas instruções estão bloqueadas até reconectar.</p>}
          <OfficeMap device={device} online={online} business={business} onBusiness={setBusiness} selectedId={selected?.deviceId===device.id?selected.agentId:undefined}
            onSelect={agent=>setSelected({deviceId:device.id,agentId:agent.id,sessionId:agent.sessionId})} />
          <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Últimos envios</summary>
            <ul className="space-y-2 mt-3">{device.commands.filter(c => device.snapshot.agents.some(a => a.id===c.agent_id && a.businessId===business)).map(c => <li key={c.id} className="text-xs break-words">{new Date(c.created_at).toLocaleTimeString('pt-BR')} · {COMMAND[c.status] || c.status}</li>)}</ul>
          </details>
        </section>;
      })}
      <Sheet open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}>
        <SheetContent side={mobile?'bottom':'right'} className="overflow-y-auto max-h-[90dvh] md:max-h-none w-full sm:max-w-lg">
          <SheetHeader className="mb-5 text-left"><SheetTitle>{selectedAgent?.name || 'Sessão encerrada'}</SheetTitle><SheetDescription>{selectedAgent ? `${selectedAgent.businessId==='imperio'?'Império':'Consultoria de Bandeiras'} · ${selectedDevice?.snapshot.rooms.find(r=>r.id===selectedAgent.roomId)?.areaName || 'Projeto'}` : 'Este agente saiu do escritório ou iniciou outra sessão. Selecione-o novamente no mapa.'}</SheetDescription></SheetHeader>
          {selectedAgent && selectedDevice && <AgentCommand key={`${selectedAgent.id}:${selectedAgent.sessionId}`} agent={selectedAgent} device={selectedDevice} online={selectedDevice.online && fresh} refresh={()=>void queryClient.invalidateQueries({queryKey:['office-command']})} />}
        </SheetContent>
      </Sheet>
      <p className="text-xs text-muted-foreground">Arte do <a className="underline underline-offset-4" href="https://github.com/marmottajr/habblaud" target="_blank" rel="noreferrer">Habblaud</a> · Márcio Junior · <a className="underline underline-offset-4" href="/licenses/habblaud.txt" target="_blank" rel="noreferrer">MIT</a></p>
    </>}
  </div>;
}
