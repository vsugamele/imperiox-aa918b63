import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseConfig, type Config, type Decision, type Stage } from "@/lib/cinna-shield-x1/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Snapshot { config: Config; revision: number; aiConfigured: boolean; model: string; connected: boolean }
interface ChatLine { id: string; role: "assistant" | "user"; text: string }
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("cinna-shield-x1", { body });
  if (error || !data) throw new Error(error?.message ?? "O servidor não retornou dados.");
  return data;
}

export default function CinnaShieldX1() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [selected, setSelected] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [message, setMessage] = useState("");
  const retry = useRef<{text: string; eventId: string} | null>(null);
  const dirty = !!snapshot && JSON.stringify(snapshot.config) !== JSON.stringify(draft);
  const load = useCallback(async () => {
    setPending(true); setError("");
    try {
      const result = await invoke<Snapshot>({ op: "get" });
      result.config = parseConfig(result.config);
      setSnapshot(result); setDraft(structuredClone(result.config));
      setSessionId(null); setDecision(null); setLines([]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao carregar configuração."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const changeStage = (patch: Partial<Stage>) => setDraft(current => current && ({ ...current, stages: current.stages.map((stage, i) => i === selected ? { ...stage, ...patch } : stage) }));
  const save = async () => {
    if (!draft || !snapshot) return;
    setPending(true); setError(""); setNotice("");
    try {
      const config = parseConfig(draft);
      const result = await invoke<{config: Config; revision: number}>({ op: "save", config, expectedRevision: snapshot.revision });
      const saved = parseConfig(result.config);
      setSnapshot({ ...snapshot, config: saved, revision: result.revision }); setDraft(structuredClone(saved));
      setSessionId(null); setDecision(null); setLines([]); setNotice("Configuração salva no Supabase. Inicie uma nova conversa para testar esta versão.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Não foi possível salvar. Em caso de conflito, recarregue antes de editar novamente."); }
    finally { setPending(false); }
  };
  const test = async (text?: string) => {
    if (dirty || pending) return;
    if (text === undefined) retry.current = null;
    else if (!retry.current || retry.current.text !== text) retry.current = {text, eventId: crypto.randomUUID()};
    setPending(true); setError("");
    try {
      const result = text === undefined
        ? await invoke<{sessionId: string; decision: Decision}>({ op: "start" })
        : await invoke<{sessionId?: string; decision: Decision}>({ op: "message", sessionId, eventId: retry.current?.eventId, message: text, revision: decision?.state.revision });
      if (result.sessionId) setSessionId(result.sessionId);
      retry.current = null;
      setDecision(result.decision);
      const incoming = result.decision.messages.map(value => ({ id: crypto.randomUUID(), role: "assistant" as const, text: value }));
      setLines(previous => text === undefined ? incoming : [...previous, { id: crypto.randomUUID(), role: "user", text }, ...incoming]);
      setMessage("");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha na conversa. Inicie uma nova sessão para retomar."); }
    finally { setPending(false); }
  };
  const stage = draft?.stages[selected];
  const canSend = !!sessionId && decision?.state.status === "active" && !dirty && !pending;
  return <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
    <Link to="/openflow" className="text-sm text-muted-foreground underline">Voltar ao OpenFlow</Link>
    <div className="flex flex-wrap justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Cinna Shield · X1</h1><p className="text-muted-foreground">Confira o roteiro, ajuste a copy e teste a conversa no servidor do Império.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={pending || dirty} onClick={() => void load()}>Recarregar</Button><Button disabled={!dirty || pending} onClick={() => void save()}>Salvar configuração</Button></div>
    </div>
    {error && <div role="alert" className="rounded border border-destructive p-3 text-destructive">{error}<p className="text-sm">Se outra pessoa salvou a configuração, recarregue a página para obter a versão atual.</p></div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {!draft || !snapshot ? <p role="status">{pending ? "Carregando do Supabase…" : "Configuração indisponível. Use Recarregar para tentar novamente."}</p> : <>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">Revisão {snapshot.revision}</Badge><Badge variant="outline">{snapshot.aiConfigured ? `IA configurada · ${snapshot.model}` : "IA não configurada · respostas por regras"}</Badge><Badge variant="secondary">{snapshot.connected ? "Canais conectados" : "Facebook / Instagram não conectados"}</Badge>{dirty && <Badge variant="destructive">Alterações não salvas</Badge>}</div>
      <section aria-label="Mapa do fluxo" className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2">{draft.stages.map((item, index) => <button key={item.id} aria-pressed={selected === index} onClick={() => setSelected(index)} className={`rounded-lg border p-3 text-left text-sm transition-colors ${selected === index ? "border-primary bg-primary/10" : "hover:bg-muted"}`}><span className="text-xs text-muted-foreground">Etapa {index + 1}</span><span className="block font-medium mt-1">{item.title}</span>{decision?.stageId === item.id && <span className="block text-xs mt-2 text-primary">Conversa aqui</span>}</button>)}</div>
        <p className="text-sm text-muted-foreground">Resposta → próxima etapa · Dúvida → responde e mantém a etapa · Compra → oferta aprovada ou pausa · Parar / humano → encerra a automação.</p>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {stage && <Card><CardHeader><CardTitle>Etapa {selected + 1}: {stage.title}</CardTitle></CardHeader><CardContent className="space-y-4">
            {stage.messages.map((text, index) => <div key={index}><Label htmlFor={`message-${index}`}>Mensagem {index + 1}</Label><Textarea id={`message-${index}`} disabled={pending} value={text} onChange={event => changeStage({ messages: stage.messages.map((value, i) => i === index ? event.target.value : value) })} className="min-h-24" /></div>)}
            <Label htmlFor="stage-question">Pergunta da etapa</Label><Textarea id="stage-question" disabled={pending} value={stage.question} onChange={event => changeStage({question: event.target.value})} />
            {stage.choices?.map((choice, index) => <div key={index} className="rounded border p-3 space-y-2"><Label htmlFor={`choice-${index}`}>Escolha {index + 1}</Label><Input id={`choice-${index}`} disabled={pending} value={choice.label} onChange={event => changeStage({choices: stage.choices?.map((value, i) => i === index ? {...value, label: event.target.value} : value)})}/><Label htmlFor={`ack-${index}`}>Resposta contextual</Label><Textarea id={`ack-${index}`} disabled={pending} value={choice.acknowledgement} onChange={event => changeStage({choices: stage.choices?.map((value, i) => i === index ? {...value, acknowledgement: event.target.value} : value)})}/></div>)}
          </CardContent></Card>}
          <Card><CardHeader><CardTitle>Oferta</CardTitle></CardHeader><CardContent className="space-y-3"><Label htmlFor="price">Preço e pacote confirmados</Label><Input id="price" disabled={pending} value={draft.offer.priceLabel ?? ""} onChange={event => setDraft({...draft, offer: {...draft.offer, priceLabel: event.target.value || null}})}/><Label htmlFor="checkout">Checkout HTTPS</Label><Input id="checkout" disabled={pending} value={draft.offer.checkoutUrl ?? ""} onChange={event => setDraft({...draft, offer: {...draft.offer, checkoutUrl: event.target.value || null}})}/><label className="flex gap-2 items-center text-sm"><input type="checkbox" disabled={pending} checked={draft.offer.approved} onChange={event => setDraft({...draft, offer: {...draft.offer, approved: event.target.checked}})}/>Oferta e checkout conferidos e aprovados</label></CardContent></Card>
          <details className="rounded border p-4"><summary className="cursor-pointer font-medium">Respostas para dúvidas e objeções</summary><div className="space-y-3 mt-4">{Object.entries(draft.replies).map(([key, value]) => <div key={key}><Label htmlFor={`reply-${key}`}>{key}</Label><Textarea id={`reply-${key}`} disabled={pending} value={value} onChange={event => setDraft({...draft, replies: {...draft.replies, [key]: event.target.value}})}/></div>)}</div></details>
        </div>
        <Card className="h-fit lg:sticky lg:top-4"><CardHeader><div className="flex justify-between gap-2 items-center"><CardTitle>Testar conversa</CardTitle><Button variant="outline" disabled={pending || dirty} onClick={() => void test()}>Nova conversa</Button></div><p className="text-sm text-muted-foreground">Sessão de teste salva no Supabase. Nenhuma mensagem é enviada aos canais. Não use dados pessoais de clientes.</p>{dirty && <p className="text-sm text-amber-600">Salve as alterações antes de testar.</p>}</CardHeader><CardContent className="space-y-4">
          <div aria-live="polite" className="max-h-[480px] min-h-32 overflow-y-auto space-y-3">{lines.length ? lines.map(line => <div key={line.id} className={`rounded-lg p-3 whitespace-pre-wrap text-sm ${line.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}><span className="block text-xs opacity-70 mb-1">{line.role === "user" ? "Você" : "Cinna Shield"}</span>{line.text}</div>) : <p className="text-sm text-muted-foreground">Inicie uma conversa para conferir a versão salva.</p>}</div>
          {decision && <p className="text-xs text-muted-foreground">Ação: {decision.action} · Intenção: {decision.intent} · Origem: {decision.source} · Estado: {decision.state.status}</p>}
          {decision?.warning && <p role="status" className="text-xs text-amber-600">{decision.warning}</p>}
          <div className="flex flex-wrap gap-2">{decision?.choices?.map(choice => <Button key={choice} variant="outline" size="sm" disabled={!canSend} onClick={() => void test(choice)}>{choice}</Button>)}</div>
          <form className="flex gap-2" onSubmit={event => {event.preventDefault(); if (canSend && message.trim()) void test(message.trim());}}><Input aria-label="Mensagem de teste" disabled={!canSend} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Digite sua resposta…"/><Button type="submit" disabled={!canSend || !message.trim()}>{pending ? "Aguarde…" : "Enviar"}</Button></form>
        </CardContent></Card>
      </div>
    </>}
  </div>;
}
