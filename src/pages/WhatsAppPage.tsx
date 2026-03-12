import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, QrCode, MessageSquare, ExternalLink, Copy, Download, Phone } from "lucide-react";
import { toast } from "sonner";

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
}

export default function WhatsApp() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [form, setForm] = useState({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" });

  const load = async () => {
    const [sRes, pRes] = await Promise.all([
      supabase.from("imphq_wa_conversations").select("*").order("updated_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setSessions(sRes.data || []);
    setProjects(pRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = sessions.filter(s => filterProject === "all" || s.project_id === filterProject);

  const createSession = async () => {
    if (!form.phone || !form.project_id) { toast.error("Telefone e projeto obrigatórios"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_wa_conversations").insert({
      id, phone: form.phone.replace(/\D/g, ""),
      contact_name: form.contact_name || null,
      session: form.session || `session-${Date.now()}`,
      project_id: form.project_id, status: "active",
      metadata: { default_message: form.default_message } as any,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Sessão criada!"); setShowNew(false);
    setForm({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" }); load();
  };

  const deleteSession = async (id: string) => {
    await supabase.from("imphq_wa_conversations").delete().eq("id", id);
    toast.success("Sessão removida"); setSelectedSession(null); load();
  };

  const getWaLink = (phone: string, message?: string) => {
    const clean = phone.replace(/\D/g, "");
    const msg = message ? `?text=${encodeURIComponent(message)}` : "";
    return `https://wa.me/${clean}${msg}`;
  };

  const getQrUrl = (data: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}&bgcolor=1a1a2e&color=ffffff`;

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  // Detail view
  if (selectedSession) {
    const waLink = getWaLink(selectedSession.phone, (selectedSession.metadata as any)?.default_message);
    const qrUrl = getQrUrl(waLink);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>← Voltar</Button>
          <h1 className="font-display text-2xl font-bold text-primary">
            {selectedSession.contact_name || selectedSession.phone}
          </h1>
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            {selectedSession.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR Code */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> QR Code WhatsApp</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="bg-background p-4 rounded-xl border border-border">
                <img src={qrUrl} alt="QR Code WhatsApp" className="w-[250px] h-[250px] rounded-lg" />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Escaneie para iniciar conversa no WhatsApp com {selectedSession.phone}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={qrUrl} download={`qr-${selectedSession.phone}.png`}><Download className="h-3 w-3 mr-1" /> Baixar QR</a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(waLink); toast.success("Link copiado!"); }}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar Link
                </Button>
                <Button size="sm" asChild>
                  <a href={waLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Abrir</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Detalhes da Sessão</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Telefone</span><span className="font-mono">{selectedSession.phone}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Projeto</span><span>{projectName(selectedSession.project_id)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sessão</span><span className="font-mono text-xs">{selectedSession.session}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mensagens</span><span className="font-mono">{selectedSession.message_count}</span></div>
                {(selectedSession.metadata as any)?.default_message && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mensagem padrão:</p>
                    <p className="text-xs bg-secondary p-2 rounded">{(selectedSession.metadata as any).default_message}</p>
                  </div>
                )}
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Link direto:</p>
                <div className="p-2 bg-secondary rounded text-xs text-primary break-all font-mono">{waLink}</div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => deleteSession(selectedSession.id)} className="w-full">
                <Trash2 className="h-3 w-3 mr-1" /> Excluir Sessão
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">💬 WhatsApp</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova Sessão</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} sessões</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => {
          const waLink = getWaLink(s.phone, (s.metadata as any)?.default_message);
          const qrUrl = getQrUrl(waLink);
          return (
            <Card key={s.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors group" onClick={() => setSelectedSession(s)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-background p-1 shrink-0">
                    <img src={qrUrl} alt="QR" className="w-full h-full rounded" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{s.contact_name || s.phone}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{s.phone}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{projectName(s.project_id)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{s.status}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" /> {s.message_count}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão WhatsApp</p>}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Sessão WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Telefone (com DDI)</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" /></div>
            <div><Label>Nome do contato</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Opcional" /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mensagem padrão</Label><Textarea value={form.default_message} onChange={e => setForm({ ...form, default_message: e.target.value })} placeholder="Olá! Vi seu anúncio e gostaria de saber mais..." rows={3} /></div>
            <div><Label>Nome da sessão</Label><Input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} placeholder="Gerado automaticamente se vazio" /></div>
          </div>
          <DialogFooter><Button onClick={createSession}>Criar Sessão</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
