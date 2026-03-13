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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Code2, Bot, Database, Palette, Zap, Search, Server,
  Github, Terminal, Sparkles, Eye, AudioLines, PenTool,
  Sheet, CloudSun, BarChart3, ShoppingCart, Banana, ImagePlus,
  Film, FrameIcon, Send, Youtube, Globe, HeartPulse, Plus,
  Pencil, Trash2, type LucideIcon, Brain, Bomb, Target, MousePointer2, FileText, Swords, Shield
} from "lucide-react";
import { toast } from "sonner";
import { SKILLS_DATA, SkillData } from "@/data/skillsData";

type Status = "Ativo" | "Beta" | "Planejado";
type Categoria = "Código" | "IA" | "Dados" | "Criativo" | "Automação" | "Pesquisa" | "Infra" | "Outro" | "Pesquisa & Avatar" | "Copy & Persuasão" | "Inteligência Competitiva" | "Estratégia & Posicionamento" | "Vendas High-Ticket";

interface Skill {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  status: Status;
  icone: string;
  is_default?: boolean;
  system_prompt?: string;
  versao?: string;
  gatilho?: string;
  cor?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Code2, Bot, Database, Palette, Zap, Search, Server,
  Github, Terminal, Sparkles, Eye, AudioLines, PenTool,
  Sheet, CloudSun, BarChart3, ShoppingCart, Banana, ImagePlus,
  Film, FrameIcon, Send, Youtube, Globe, HeartPulse, Plus, Pencil,
  Brain, Bomb, Target, MousePointer2, FileText, Swords, Shield,
  "🧠": Brain,
  "💣": Bomb,
  "🕵️": Search,
  "⚗️": Sparkles,
  "🎯": Target,
  "♟️": Target,
  "🪤": MousePointer2,
  "📄": FileText,
  "⚔️": Swords,
  "🔍": Search,
  "🎭": Eye,
  "✍️": PenTool
};

const DEFAULT_SKILLS: Skill[] = [
  ...SKILLS_DATA.map(sd => ({
    id: sd.id,
    nome: sd.nome,
    descricao: sd.descricao,
    categoria: sd.categoria as Categoria,
    status: sd.status as Status,
    icone: sd.icone,
    is_default: true,
    system_prompt: sd.system_prompt,
    versao: sd.versao,
    gatilho: sd.gatilho,
    cor: sd.cor
  })),
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
  { id: "telegram-bot", nome: "Telegram Bot", descricao: "Bot para comunicação e automações no Telegram", categoria: "Automação", status: "Ativo", icone: "Send", is_default: true },
  { id: "youtube", nome: "YouTube", descricao: "Busca e análise de conteúdos no YouTube", categoria: "Pesquisa", status: "Ativo", icone: "Youtube", is_default: true },
  { id: "market-scraper", nome: "Market Scraper", descricao: "Coleta de dados de mercado e concorrentes", categoria: "Pesquisa", status: "Beta", icone: "Globe", is_default: true },
];

const CATEGORIA_ICONS: Record<string, LucideIcon> = {
  "Código": Code2, "IA": Bot, "Dados": Database, "Criativo": Palette,
  "Automação": Zap, "Pesquisa": Search, "Infra": Server, "Outro": Zap,
  "Pesquisa & Avatar": Brain, "Copy & Persuasão": PenTool,
  "Inteligência Competitiva": Globe, "Estratégia & Posicionamento": Target,
  "Vendas High-Ticket": Shield
};

const STATUS_STYLES: Record<Status, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Beta: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Planejado: "bg-muted text-muted-foreground border-border",
};

const CATEGORIAS: Categoria[] = ["Pesquisa & Avatar", "Copy & Persuasão", "Inteligência Competitiva", "Estratégia & Posicionamento", "Vendas High-Ticket", "Código", "IA", "Dados", "Criativo", "Automação", "Pesquisa", "Infra", "Outro"];
const ICON_NAMES = Object.keys(ICON_MAP).filter(k => !k.includes(' '));

export default function Skills() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Skill | null>(null);
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

  const openEdit = (e: React.MouseEvent, skill: Skill) => {
    e.stopPropagation();
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

  const deleteSkill = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("imphq_skills").delete().eq("id", id);
    setCustomSkills(prev => prev.filter(s => s.id !== id));
    toast.success("Skill removida!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">Skills & Engines</h1>
          <p className="text-sm text-muted-foreground mt-1">{ativos} ativas · {allSkills.length} no arsenal</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Skill</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Buscar skill..." value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:max-w-xs bg-secondary/20" />
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="sm:w-44 bg-secondary/20"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="sm:w-36 bg-secondary/20"><SelectValue placeholder="Status" /></SelectTrigger>
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
          <div key={categoria} className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <CatIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{categoria}</h2>
              <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{skills.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => {
                const Icon = ICON_MAP[skill.icone] || Zap;
                const skillColor = skill.cor || "#3b82f6";
                return (
                  <Card 
                    key={skill.id} 
                    className="group cursor-pointer hover:border-primary/50 hover:bg-secondary/10 transition-all duration-300 relative overflow-hidden h-full flex flex-col"
                    onClick={() => setShowDetail(skill)}
                  >
                    {skill.cor && (
                      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: skillColor }} />
                    )}
                    <CardContent className="p-4 sm:p-5 flex flex-col flex-1 gap-3 relative z-10">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="rounded-lg p-2 flex items-center justify-center shrink-0" 
                            style={{ backgroundColor: `${skillColor}20`, color: skillColor }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-[15px] text-foreground block">{skill.nome}</span>
                            {skill.versao && (
                              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                                {skill.versao}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`${STATUS_STYLES[skill.status]} text-[10px] px-1.5 py-0`}>{skill.status}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">{skill.descricao}</p>
                      
                      {!skill.is_default && (
                        <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md shadow-sm border p-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => openEdit(e, skill)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={(e) => deleteSkill(e, skill.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* DETALHE DA SKILL (RAIO-X) */}
      <Dialog open={!!showDetail} onOpenChange={(open) => !open && setShowDetail(null)}>
        <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden shadow-2xl">
          {showDetail && (
            <>
              <div 
                className="h-2 w-full absolute top-0 left-0" 
                style={{ backgroundColor: showDetail.cor || "#3b82f6" }} 
              />
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                    style={{ backgroundColor: `${showDetail.cor || "#3b82f6"}20`, color: showDetail.cor || "#3b82f6" }}
                  >
                    {(() => {
                      const Icon = ICON_MAP[showDetail.icone] || Zap;
                      return <Icon className="w-6 h-6" />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <DialogTitle className="text-2xl font-display font-bold tracking-tight">
                        {showDetail.nome}
                      </DialogTitle>
                      {showDetail.versao && (
                        <Badge variant="outline" className="font-mono text-xs text-muted-foreground bg-secondary/50 border-white/5">
                          {showDetail.versao}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/70 leading-relaxed max-w-lg">
                      {showDetail.descricao}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 bg-secondary/20 p-3 rounded-lg border border-white/5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Categoria</span>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {(() => {
                        const CatIcon = CATEGORIA_ICONS[showDetail.categoria] || Zap;
                        return <CatIcon className="w-4 h-4 text-primary" />;
                      })()}
                      {showDetail.categoria}
                    </div>
                  </div>
                  <div className="space-y-1.5 bg-secondary/20 p-3 rounded-lg border border-white/5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Status</span>
                    <Badge variant="outline" className={STATUS_STYLES[showDetail.status]}>{showDetail.status}</Badge>
                  </div>
                </div>

                {showDetail.gatilho && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5" /> Gatilho de Ativação
                    </span>
                    <div className="bg-primary/5 border border-primary/20 text-primary-foreground/90 p-3 rounded-md font-mono text-sm shadow-inner">
                      {showDetail.gatilho}
                    </div>
                  </div>
                )}

                {showDetail.system_prompt && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5" /> System Prompt (Engine DNA)
                    </span>
                    <ScrollArea className="h-64 w-full rounded-md border border-white/10 bg-black/40 p-4 shadow-inner">
                      <pre className="text-xs font-mono text-green-400/90 whitespace-pre-wrap leading-relaxed">
                        {showDetail.system_prompt}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* FORM DE NOVA SKILL */}
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
                    return <SelectItem key={name} value={name}><span className="flex items-center gap-2">{I && <I className="h-3 w-3" />}{name}</span></SelectItem>;
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
