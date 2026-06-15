import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Radio, Plus, Calendar, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ConteudoTabs } from "@/components/planejar/ConteudoTabs";

export default function Webinar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", nome: "", scheduled_at: "", checkout_url: "" });

  useEffect(() => { load(); }, [user?.id]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: pjs } = await supabase
      .from("imphq_projects").select("id, name").eq("user_id", user.id).eq("is_archived", false);
    setProjects(pjs || []);
    const { data: ss } = await supabase
      .from("imphq_webinar_sessions").select("*").order("created_at", { ascending: false });
    setSessions(ss || []);
    setLoading(false);
  }

  async function createSession() {
    if (!form.project_id || !form.nome) { toast.error("Preencha projeto e nome"); return; }
    const { data, error } = await supabase.from("imphq_webinar_sessions").insert({
      project_id: form.project_id,
      nome: form.nome,
      scheduled_at: form.scheduled_at || null,
      checkout_url: form.checkout_url || "",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Sessão criada");
    setOpen(false);
    navigate(`/webinar/${data.id}`);
  }

  return (
    <div className="p-6 space-y-6">
      <ConteudoTabs />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif flex items-center gap-3">
            <Radio className="h-7 w-7 text-primary" /> Webinar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identifique quem clicou no pitch e recupere automaticamente via WhatsApp.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova sessão</Button>
          </DialogTrigger>
          <DialogContent className="bg-secondary/40">
            <DialogHeader><DialogTitle>Nova sessão de webinar</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Projeto</Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nome da sessão</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Webinar 25/05" />
              </div>
              <div>
                <Label className="text-xs">Data e hora</Label>
                <Input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">URL do checkout</Label>
                <Input value={form.checkout_url} onChange={e => setForm(f => ({ ...f, checkout_url: e.target.value }))} placeholder="https://pay..." />
              </div>
            </div>
            <DialogFooter><Button onClick={createSession}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && sessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma sessão ainda. Crie a primeira para gerar links mágicos por lead.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map(s => (
          <Card key={s.id} className="hover:border-primary/60 transition">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {s.nome}
                <Badge variant="secondary" className="text-[10px]">{s.scheduled_at ? "agendado" : "rascunho"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.scheduled_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {format(new Date(s.scheduled_at), "dd/MM/yyyy HH:mm")}
                </p>
              )}
              <Link to={`/webinar/${s.id}`}>
                <Button variant="ghost" size="sm" className="gap-1 w-full justify-between">
                  Gerenciar <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
