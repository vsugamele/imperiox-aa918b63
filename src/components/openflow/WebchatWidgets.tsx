import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Globe, MessageCircle, Plus, Trash2 } from "lucide-react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Widget {
  id: string;
  project_id: string | null;
  public_key: string;
  nome: string;
  titulo: string;
  cor: string;
  saudacao: string;
  automacao_id: string | null;
  allowed_origins: string[];
  ativo: boolean;
  tema?: string;
  avatar_url?: string | null;
  subtitulo?: string;
  som?: boolean;
  texto_digitando?: string;
  texto_gravando?: string;
}

interface Props {
  projects: { id: string; nome?: string; name?: string }[];
  automacoes: { id: string; nome: string; canal?: string }[];
}

export function WebchatWidgets({ projects, automacoes }: Props) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgProject, setMsgProject] = useState<string>("");

  const load = async () => {
    const { data } = await (supabase as any)
      .from("imphq_webchat_widgets")
      .select("*")
      .order("created_at", { ascending: false });
    setWidgets((data || []) as Widget[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { error } = await (supabase as any).from("imphq_webchat_widgets").insert({
      nome: "Chat do site",
      titulo: "Fale com a gente",
    });
    if (error) return toast.error(error.message);
    toast.success("Widget criado");
    load();
  };

  const patch = async (id: string, values: Partial<Widget>) => {
    setWidgets(ws => ws.map(w => (w.id === id ? { ...w, ...values } : w)));
    const { error } = await (supabase as any).from("imphq_webchat_widgets").update(values).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("imphq_webchat_widgets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Widget removido");
    load();
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const snippet = (w: Widget) =>
    `<script src="${window.location.origin}/webchat.js" data-key="${w.public_key}" data-endpoint="${SUPA_URL}/functions/v1/webchat-api" defer></script>`;

  const messengerUrl = msgProject
    ? `${SUPA_URL}/functions/v1/messenger-webhook?project=${msgProject}`
    : `${SUPA_URL}/functions/v1/messenger-webhook?project=SEU_PROJETO`;

  const webchatFlows = automacoes.filter(a => (a.canal || "whatsapp") === "webchat");

  return (
    <div className="space-y-6 pt-4">
      {/* Messenger via Zernio */}
      <Card className="bg-secondary/20 border-white/10">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg">Messenger via Zernio</h3>
            <Badge variant="outline" className="text-[10px]">canal: messenger</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-6">
            Cole a URL abaixo como webhook de mensagens no painel do Zernio. As DMs do Messenger criam uma
            conversa e disparam os fluxos do OpenFlow com canal <strong>Messenger</strong>. As respostas do
            fluxo saem pelo MCP do Zernio, usando a <code className="px-1 rounded bg-background/60">zernio_api_key</code> do projeto.
          </p>
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] items-end">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Projeto</Label>
              <Select value={msgProject || undefined} onValueChange={setMsgProject}>
                <SelectTrigger className="h-9 bg-background/50 border-white/10"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome || p.name || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Webhook URL</Label>
              <Input readOnly value={messengerUrl} className="h-9 bg-background/50 border-white/10 text-xs font-mono" />
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(messengerUrl, "Webhook")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Gatilhos disponíveis nos fluxos: <code>messenger_mensagem_recebida</code> e <code>messenger_palavra_chave</code>.
          </p>
        </CardContent>
      </Card>

      {/* Webchat */}
      <Card className="bg-secondary/20 border-white/10">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg">Chat no site (widget)</h3>
              <Badge variant="outline" className="text-[10px]">canal: webchat</Badge>
            </div>
            <Button size="sm" onClick={create}><Plus className="h-3.5 w-3.5 mr-1" /> Novo widget</Button>
          </div>

          {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {!loading && widgets.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum widget ainda. Crie um e cole o snippet no seu site.</p>
          )}

          <div className="space-y-4">
            {widgets.map(w => (
              <div key={w.id} className="rounded-xl border border-white/10 bg-background/40 p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Nome interno</Label>
                    <Input value={w.nome} onChange={e => patch(w.id, { nome: e.target.value })} className="h-9 bg-secondary/40 border-white/10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Título no chat</Label>
                    <Input value={w.titulo} onChange={e => patch(w.id, { titulo: e.target.value })} className="h-9 bg-secondary/40 border-white/10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Cor</Label>
                    <Input type="color" value={w.cor} onChange={e => patch(w.id, { cor: e.target.value })} className="h-9 p-1 bg-secondary/40 border-white/10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Projeto</Label>
                    <Select value={w.project_id || undefined} onValueChange={v => patch(w.id, { project_id: v })}>
                      <SelectTrigger className="h-9 bg-secondary/40 border-white/10"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome || p.name || p.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Saudação</Label>
                    <Textarea value={w.saudacao} onChange={e => patch(w.id, { saudacao: e.target.value })} className="min-h-[64px] bg-secondary/40 border-white/10 text-sm leading-7" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Fluxo que responde</Label>
                    <Select value={w.automacao_id || "__none__"} onValueChange={v => patch(w.id, { automacao_id: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-9 bg-secondary/40 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Qualquer fluxo do canal webchat</SelectItem>
                        {webchatFlows.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Marque o canal do fluxo como “Chat do site” para ele aparecer aqui.
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Domínios permitidos (vírgula) — vazio libera todos</Label>
                  <Input
                    value={(w.allowed_origins || []).join(", ")}
                    onChange={e => patch(w.id, { allowed_origins: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    placeholder="meusite.com, lp.meusite.com"
                    className="h-9 bg-secondary/40 border-white/10"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Snippet de instalação</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={snippet(w)} className="h-9 bg-secondary/40 border-white/10 text-[11px] font-mono" />
                    <Button variant="outline" size="sm" onClick={() => copy(snippet(w), "Snippet")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={w.ativo} onCheckedChange={v => patch(w.id, { ativo: v })} />
                    <span className="text-xs text-muted-foreground">{w.ativo ? "Ativo" : "Pausado"}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => remove(w.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
