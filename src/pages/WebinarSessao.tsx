import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Save, Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Step { delay_minutes: number; message: string; }

export default function WebinarSessao() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [regs, setRegs] = useState<any[]>([]);
  const [clicks, setClicks] = useState<any[]>([]);
  const [newReg, setNewReg] = useState({ nome: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => { load(); }, [sessionId]);

  async function load() {
    if (!sessionId) return;
    const [s, r, c] = await Promise.all([
      supabase.from("imphq_webinar_sessions").select("*").eq("id", sessionId).maybeSingle() as PromiseLike<any>,
      supabase.from("imphq_webinar_registrations").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }) as PromiseLike<any>,
      supabase.from("imphq_webinar_clicks").select("*, imphq_webinar_registrations(nome, email, phone)").eq("session_id", sessionId).order("clicked_at", { ascending: false }) as PromiseLike<any>,
    ]);
    setSession(s.data);
    setRegs(r.data || []);
    setClicks(c.data || []);
  }

  async function saveSession() {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.from("imphq_webinar_sessions").update({
      nome: session.nome,
      scheduled_at: session.scheduled_at,
      checkout_url: session.checkout_url,
      pitch_label: session.pitch_label,
      recovery_template: session.recovery_template,
    }).eq("id", session.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Salvo");
  }

  async function addReg() {
    if (!newReg.nome) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("imphq_webinar_registrations").insert({
      session_id: sessionId, ...newReg,
    });
    if (error) toast.error(error.message);
    else { setNewReg({ nome: "", email: "", phone: "" }); load(); }
  }

  const stats = useMemo(() => {
    const total = regs.length;
    const clicked = regs.filter(r => r.status === "clicked").length;
    const bought = regs.filter(r => r.status === "bought").length;
    const recovering = clicks.filter(c => !c.sale_id).length;
    return { total, clicked, bought, recovering };
  }, [regs, clicks]);

  function pitchUrl(token: string) {
    const projectRef = "tkbivipqiewkfnhktmqq";
    return `https://${projectRef}.supabase.co/functions/v1/webinar-pitch-click?s=${sessionId}&t=${token}`;
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  async function reconcileNow() {
    const { data, error } = await supabase.functions.invoke("webinar-reconcile-sales");
    if (error) toast.error(error.message); else toast.success(`Processado: ${JSON.stringify(data)}`);
    load();
  }

  if (!session) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  const steps: Step[] = Array.isArray(session.recovery_template) ? session.recovery_template : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/webinar"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-serif">{session.nome}</h1>
            <p className="text-xs text-muted-foreground">
              {session.scheduled_at && format(new Date(session.scheduled_at), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reconcileNow} className="gap-1"><Send className="h-3 w-3" /> Processar fila agora</Button>
          <Button onClick={saveSession} disabled={saving} className="gap-1"><Save className="h-3 w-3" /> Salvar</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Inscritos", v: stats.total },
          { l: "Clicaram no pitch", v: stats.clicked },
          { l: "Compraram", v: stats.bought, accent: true },
          { l: "Recuperando (WA)", v: stats.recovering },
        ].map(k => (
          <Card key={k.l}><CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{k.l}</p>
            <p className={`text-2xl font-serif ${k.accent ? "text-primary" : ""}`}>{k.v}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="regs">Inscritos ({regs.length})</TabsTrigger>
          <TabsTrigger value="clicks">Cliques sem venda ({stats.recovering})</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle className="text-base">Dados da sessão</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">Nome</Label>
                <Input value={session.nome} onChange={e => setSession({ ...session, nome: e.target.value })} /></div>
              <div><Label className="text-xs">Data e hora</Label>
                <Input type="datetime-local" value={session.scheduled_at?.slice(0,16) || ""}
                  onChange={e => setSession({ ...session, scheduled_at: e.target.value })} /></div>
              <div><Label className="text-xs">URL do checkout (para onde o lead vai ao clicar)</Label>
                <Input value={session.checkout_url || ""} onChange={e => setSession({ ...session, checkout_url: e.target.value })} placeholder="https://pay..." /></div>
            </CardContent>
          </Card>

          <Card><CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Sequência de recuperação WhatsApp
              <Button size="sm" variant="ghost" onClick={() => setSession({ ...session, recovery_template: [...steps, { delay_minutes: 60, message: "" }] })}>
                <Plus className="h-3 w-3 mr-1" /> Passo
              </Button>
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-7">
                Use <code className="text-primary">[NOME]</code> para personalizar. As mensagens são canceladas automaticamente quando a venda chega.
              </p>
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start p-3 rounded-lg bg-secondary/40">
                  <div className="w-24 shrink-0">
                    <Label className="text-[10px] text-muted-foreground">Após (min)</Label>
                    <Input type="number" value={step.delay_minutes}
                      onChange={e => {
                        const ns = [...steps]; ns[i] = { ...step, delay_minutes: Number(e.target.value) };
                        setSession({ ...session, recovery_template: ns });
                      }} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px] text-muted-foreground">Mensagem</Label>
                    <Textarea value={step.message} className="min-h-[60px]"
                      onChange={e => {
                        const ns = [...steps]; ns[i] = { ...step, message: e.target.value };
                        setSession({ ...session, recovery_template: ns });
                      }} />
                  </div>
                  <Button variant="ghost" size="icon" className="mt-5"
                    onClick={() => setSession({ ...session, recovery_template: steps.filter((_, x) => x !== i) })}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regs" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle className="text-base">Adicionar inscrito</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                <Input placeholder="Nome" value={newReg.nome} onChange={e => setNewReg({ ...newReg, nome: e.target.value })} />
                <Input placeholder="Email" value={newReg.email} onChange={e => setNewReg({ ...newReg, email: e.target.value })} />
                <Input placeholder="WhatsApp (com DDD)" value={newReg.phone} onChange={e => setNewReg({ ...newReg, phone: e.target.value })} />
                <Button onClick={addReg}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-7">
                Link público de inscrição: <code className="text-primary">{origin}/w/{sessionId}</code>
                <Button size="sm" variant="ghost" className="ml-2 h-6" onClick={() => copy(`${origin}/w/${sessionId}`)}><Copy className="h-3 w-3" /></Button>
              </p>
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr><th className="text-left p-3">Nome</th><th className="text-left p-3">Contato</th><th className="text-left p-3">Status</th><th className="text-left p-3">Link mágico do pitch</th></tr>
              </thead>
              <tbody>
                {regs.map(r => (
                  <tr key={r.id} className="border-t border-border/30">
                    <td className="p-3">{r.nome}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.email}<br/>{r.phone}</td>
                    <td className="p-3"><Badge variant={r.status === "bought" ? "default" : "secondary"} className="text-[10px]">{r.status}</Badge></td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" className="gap-1 text-[10px]" onClick={() => copy(pitchUrl(r.lead_token))}>
                        <Copy className="h-3 w-3" /> Copiar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="clicks" className="mt-4">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr><th className="text-left p-3">Lead</th><th className="text-left p-3">Clicou em</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {clicks.map(c => (
                  <tr key={c.id} className="border-t border-border/30">
                    <td className="p-3">{c.imphq_webinar_registrations?.nome}<br/><span className="text-xs text-muted-foreground">{c.imphq_webinar_registrations?.phone}</span></td>
                    <td className="p-3 text-xs">{format(new Date(c.clicked_at), "dd/MM HH:mm")}</td>
                    <td className="p-3">
                      {c.sale_id
                        ? <Badge className="text-[10px]">comprou</Badge>
                        : <Badge variant="secondary" className="text-[10px]">recuperando</Badge>}
                    </td>
                  </tr>
                ))}
                {clicks.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum clique no pitch ainda.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
