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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, MessageSquare, ExternalLink, Copy, Phone, Settings2, Send, Megaphone } from "lucide-react";
import { toast } from "sonner";
import ChatView from "@/components/whatsapp/ChatView";
import QrCodePanel from "@/components/whatsapp/QrCodePanel";
import ProviderConfigDialog from "@/components/whatsapp/ProviderConfigDialog";
import BulkSendDialog from "@/components/whatsapp/BulkSendDialog";

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
  provider_id: string | null;
}

export default function WhatsApp() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [form, setForm] = useState({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" });

  const load = async () => {
    const [sRes, pRes, provRes] = await Promise.all([
      supabase.from("imphq_wa_conversations").select("*").order("updated_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_wa_providers").select("*").eq("is_active", true).order("created_at"),
    ]);
    setSessions(sRes.data as any[] || []);
    setProjects(pRes.data || []);
    setProviders(provRes.data as any[] || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = sessions.filter(s => filterProject === "all" || s.project_id === filterProject);
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  const getProviderForProject = (projectId: string) => {
    return providers.find(p => p.project_id === projectId) || null;
  };

  const createSession = async () => {
    if (!form.phone || !form.project_id) { toast.error("Telefone e projeto obrigatórios"); return; }
    const provider = getProviderForProject(form.project_id);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_wa_conversations").insert({
      id, phone: form.phone.replace(/\D/g, ""),
      contact_name: form.contact_name || null,
      session: form.session || `session-${Date.now()}`,
      project_id: form.project_id, status: "active",
      provider_id: provider?.id || null,
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
    return `https://wa.me/${clean}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  };

  // ── Detail View ──
  if (selectedSession) {
    const provider = getProviderForProject(selectedSession.project_id);
    const waLink = getWaLink(selectedSession.phone, (selectedSession.metadata as any)?.default_message);

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
          {provider && (
            <Badge variant="outline" className="text-[10px]">
              {provider.provider === "evolution" ? "🟢 Evolution" : "🔵 Twilio"}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="chat" className="w-full">
          <TabsList>
            <TabsTrigger value="chat"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat</TabsTrigger>
            {provider?.provider === "evolution" && (
              <TabsTrigger value="qrcode">📱 QR Code</TabsTrigger>
            )}
            <TabsTrigger value="info"><Phone className="h-3.5 w-3.5 mr-1" /> Info</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <Card className="bg-card border-border">
              <ChatView
                conversationId={selectedSession.id}
                phone={selectedSession.phone}
                projectId={selectedSession.project_id}
                providerId={provider?.id || null}
              />
            </Card>
          </TabsContent>

          {provider?.provider === "evolution" && (
            <TabsContent value="qrcode">
              <QrCodePanel provider={provider} />
            </TabsContent>
          )}

          <TabsContent value="info">
            <Card className="bg-card border-border">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Telefone</span><span className="font-mono">{selectedSession.phone}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Projeto</span><span>{projectName(selectedSession.project_id)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sessão</span><span className="font-mono text-xs">{selectedSession.session}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mensagens</span><span className="font-mono">{selectedSession.message_count}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Provider</span><span>{provider ? `${provider.provider} (${provider.instance_name || provider.twilio_from})` : "Nenhum"}</span></div>
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(waLink); toast.success("Link copiado!"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar Link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={waLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Abrir WA</a>
                  </Button>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteSession(selectedSession.id)} className="w-full">
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir Sessão
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">💬 WhatsApp</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProviderConfig(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Provider
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
            <Megaphone className="h-4 w-4 mr-1" /> Disparo
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Sessão
          </Button>
        </div>
      </div>

      {/* Provider status */}
      {providers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {providers.map(p => (
            <Badge key={p.id} variant="outline" className="text-xs gap-1">
              {p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from} — {projectName(p.project_id)}
            </Badge>
          ))}
        </div>
      )}
      {providers.length === 0 && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Nenhum provider configurado. Configure um provider (Evolution API ou Twilio) para enviar mensagens.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowProviderConfig(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Configurar Provider
            </Button>
          </CardContent>
        </Card>
      )}

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
          const provider = getProviderForProject(s.project_id);
          return (
            <Card key={s.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors group" onClick={() => setSelectedSession(s)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{s.contact_name || s.phone}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{s.phone}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{projectName(s.project_id)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{s.status}</Badge>
                      {provider && (
                        <Badge variant="outline" className="text-[9px]">
                          {provider.provider === "evolution" ? "🟢" : "🔵"}
                        </Badge>
                      )}
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

      {/* New Session Dialog */}
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
            <div><Label>Mensagem padrão</Label><Textarea value={form.default_message} onChange={e => setForm({ ...form, default_message: e.target.value })} placeholder="Olá! Vi seu anúncio..." rows={3} /></div>
            <div><Label>Nome da sessão</Label><Input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} placeholder="Auto se vazio" /></div>
          </div>
          <DialogFooter><Button onClick={createSession}>Criar Sessão</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Config Dialog */}
      <ProviderConfigDialog open={showProviderConfig} onOpenChange={setShowProviderConfig} projects={projects} onCreated={load} />

      {/* Bulk Send Dialog */}
      <BulkSendDialog open={showBulk} onOpenChange={setShowBulk} providers={providers} />
    </div>
  );
}
