import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Code2, Bot, Database, Palette, Zap, Search, Server,
  Github, Terminal, Sparkles, Eye, AudioLines, PenTool,
  Sheet, CloudSun, BarChart3, ShoppingCart, Banana, ImagePlus,
  Film, FrameIcon, Send, Youtube, Globe, HeartPulse, Plus,
  Pencil, Trash2, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

type Status = "Ativo" | "Beta" | "Planejado";
type Categoria = "Código" | "IA" | "Dados" | "Criativo" | "Automação" | "Pesquisa" | "Infra" | "Outro";

interface Skill {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  status: Status;
  icone: string;
  is_default?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Code2, Bot, Database, Palette, Zap, Search, Server,
  Github, Terminal, Sparkles, Eye, AudioLines, PenTool,
  Sheet, CloudSun, BarChart3, ShoppingCart, Banana, ImagePlus,
  Film, FrameIcon, Send, Youtube, Globe, HeartPulse, Plus, Pencil,
};

const DEFAULT_SKILLS: Skill[] = [
  { id: "coding-agent", nome: "Coding Agent", descricao: "Agente de codificação autônomo para tarefas de desenvolvimento", categoria: "Código", status: "Ativo", icone: "Code2", is_default: true },
  { id: "github-issues", nome: "GitHub Issues", descricao: "Criação e gestão de issues no GitHub automaticamente", categoria: "Código", status: "Ativo", icone: "Github", is_default: true },
  { id: "github-cli", nome: "GitHub CLI", descricao: "Interação com repositórios via linha de comando", categoria: "Código", status: "Ativo", icone: "Terminal", is_default: true },
  { id: "skill-creator", nome: "Skill Creator", descricao: "Criador de novas skills para o sistema de agentes", categoria: "Código", status: "Beta", icone: "Sparkles", is_default: true },
  { id: "gemini-flash", nome: "Gemini Flash", descricao: "Modelo de linguagem rápido do Google para tarefas gerais", categoria: "IA", status: "Ativo", icone: "Sparkles", is_default: true },
  { id: "image-vision", nome: "Image Vision", descricao: "Análise e interpretação de imagens com IA", categoria: "IA", status: "Ativo", icone: "Eye", is_default: true },
  { id: "whisper-api", nome: "Whisper API", descricao: "Transcrição de áudio para texto com alta precisão", categoria: "IA", status: "Ativo", icone: "AudioLines", is_default: true },
  { id: "copy-engine", nome: "Copy Engine", descricao: "Geração de copies persuasivas para marketing", categoria: "IA", status: "Beta", icone: "PenTool", is_default: true },
  { id: "google-sheets", nome: "Google Sheets", descricao: "Leitura e escrita em planilhas do Google", categoria: "Dados", status: "Ativo", icone: "Sheet", is_default: true },
  { id: "weather", nome: "Weather", descricao: "Dados meteorológicos em tempo real", categoria: "Dados", status: "Ativo", icone: "CloudSun", is_default: true },
  { id: "meta-ads-api", nome: "Meta Ads API", descricao: "Métricas e gestão de campanhas Meta Ads", categoria: "Dados", status: "Beta", icone: "BarChart3", is_default: true },
  { id: "hotmart-api", nome: "Hotmart API", descricao: "Dados de vendas e assinaturas da Hotmart", categoria: "Dados", status: "Ativo", icone: "ShoppingCart", is_default: true },
  { id: "nano-banana-pro", nome: "Nano Banana Pro", descricao: "Geração de imagens estilizadas para redes sociais", categoria: "Criativo", status: "Ativo", icone: "Banana", is_default: true },
  { id: "openai-image-gen", nome: "OpenAI Image Gen", descricao: "Geração de imagens com DALL-E e GPT Image", categoria: "Criativo", status: "Ativo", icone: "ImagePlus", is_default: true },
  { id: "remotion", nome: "Remotion", descricao: "Renderização programática de vídeos", categoria: "Criativo", status: "Beta", icone: "Film", is_default: true },
  { id: "video-frames", nome: "Video Frames", descricao: "Extração e análise de frames de vídeo", categoria: "Criativo", status: "Planejado", icone: "FrameIcon", is_default: true },
  { id: "telegram-bot", nome: "Telegram Bot", descricao: "Bot para comunicação e automações no Telegram", categoria: "Automação", status: "Ativo", icone: "Send", is_default: true },
  { id: "youtube", nome: "YouTube", descricao: "Busca e análise de conteúdos no YouTube", categoria: "Pesquisa", status: "Ativo", icone: "Youtube", is_default: true },
  { id: "market-scraper", nome: "Market Scraper", descricao: "Coleta de dados de mercado e concorrentes", categoria: "Pesquisa", status: "Beta", icone: "Globe", is_default: true },
  { id: "healthcheck", nome: "Healthcheck", descricao: "Monitoramento de saúde dos serviços e APIs", categoria: "Infra", status: "Ativo", icone: "HeartPulse", is_default: true },
];

const CATEGORIA_ICONS: Record<string, LucideIcon> = {
  "Código": Code2, "IA": Bot, "Dados": Database, "Criativo": Palette,
  "Automação": Zap, "Pesquisa": Search, "Infra": Server, "Outro": Zap,
};

const STATUS_STYLES: Record<Status, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Beta: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Planejado: "bg-muted text-muted-foreground border-border",
};

const CATEGORIAS: Categoria[] = ["Código", "IA", "Dados", "Criativo", "Automação", "Pesquisa", "Infra", "Outro"];
const ICON_NAMES = Object.keys(ICON_MAP);

export default function Skills() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", categoria: "Outro" as Categoria, status: "Ativo" as Status, icone: "Zap" });

  useEffect(() => {
    if (!user) return;
    supabase.from("imphq_skills").select("*").order("created_at").then(({ data }) => {
      setCustomSkills((data || []).map((s: any) => ({
        id: s.id, nome: s.nome, descricao: s.descricao,
        categoria: s.categoria as Categoria, status: s.status as Status,
        icone: s.icone || "Zap",
      })));
    });
  }, [user]);

  const allSkills = useMemo(() => [...DEFAULT_SKILLS, ...customSkills], [customSkills]);

  const filtered = useMemo(() => {
    return allSkills.filter((s) => {
      if (busca && !s.nome.toLowerCase().includes(busca.toLowerCase()) && !s.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (catFiltro !== "all" && s.categoria !== catFiltro) return false;
      if (statusFiltro !== "all" && s.status !== statusFiltro) return false;
      return true;
    });
  }, [busca, catFiltro, statusFiltro, allSkills]);

  const grouped = useMemo(() => {
    const map = new Map<Categoria, Skill[]>();
    for (const s of filtered) {
      if (!map.has(s.categoria)) map.set(s.categoria, []);
      map.get(s.categoria)!.push(s);
    }
    return CATEGORIAS.filter((c) => map.has(c)).map((c) => ({ categoria: c, skills: map.get(c)! }));
  }, [filtered]);

  const ativos = allSkills.filter((s) => s.status === "Ativo").length;

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", categoria: "Outro", status: "Ativo", icone: "Zap" });
    setShowForm(true);
  };

  const openEdit = (skill: Skill) => {
    setEditing(skill);
    setForm({ nome: skill.nome, descricao: skill.descricao, categoria: skill.categoria, status: skill.status, icone: skill.icone });
    setShowForm(true);
  };

  const saveSkill = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    if (editing) {
      const { error } = await supabase.from("imphq_skills").update({
        nome: form.nome, descricao: form.descricao, categoria: form.categoria,
        status: form.status, icone: form.icone,
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      setCustomSkills(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s));
      toast.success("Skill atualizada!");
    } else {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("imphq_skills").insert([{
        id, nome: form.nome, descricao: form.descricao, categoria: form.categoria,
        status: form.status, icone: form.icone, owner_id: user?.id,
      }]);
      if (error) { toast.error(error.message); return; }
      setCustomSkills(prev => [...prev, { id, ...form }]);
      toast.success("Skill criada!");
    }
    setShowForm(false);
  };

  const deleteSkill = async (id: string) => {
    await supabase.from("imphq_skills").delete().eq("id", id);
    setCustomSkills(prev => prev.filter(s => s.id !== id));
    toast.success("Skill removida!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">Skills & Capacidades</h1>
          <p className="text-sm text-muted-foreground mt-1">{ativos} ativos · {allSkills.length} total</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Skill</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Buscar skill..." value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:max-w-xs" />
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Beta">Beta</SelectItem>
            <SelectItem value="Planejado">Planejado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma skill encontrada.</p>
      )}

      {grouped.map(({ categoria, skills }) => {
        const CatIcon = CATEGORIA_ICONS[categoria] || Zap;
        return (
          <div key={categoria} className="space-y-3">
            <div className="flex items-center gap-2">
              <CatIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{categoria}</h2>
              <span className="text-xs text-muted-foreground">({skills.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {skills.map((skill) => {
                const Icon = ICON_MAP[skill.icone] || Zap;
                return (
                  <Card key={skill.id} className="group hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md bg-primary/10 p-1.5">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-sm text-foreground">{skill.nome}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={STATUS_STYLES[skill.status]}>{skill.status}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{skill.descricao}</p>
                      {!skill.is_default && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(skill)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteSkill(skill.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Skill" : "Nova Skill"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Slack Bot" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="O que essa skill faz..." rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v as Categoria })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Beta">Beta</SelectItem>
                    <SelectItem value="Planejado">Planejado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ícone</Label>
              <Select value={form.icone} onValueChange={v => setForm({ ...form, icone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_NAMES.map(name => {
                    const I = ICON_MAP[name];
                    return <SelectItem key={name} value={name}><span className="flex items-center gap-2"><I className="h-3 w-3" />{name}</span></SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveSkill}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
