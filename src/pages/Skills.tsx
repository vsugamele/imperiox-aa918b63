import { useState, useMemo, useEffect, useRef } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Pencil, Trash2, type LucideIcon, Brain, Bomb, Target, MousePointer2, FileText, Swords, Shield,
  Megaphone, Video,
  ArrowRight, Info, Play, Copy, Save, Loader2, Download, Package
} from "lucide-react";
import { toast } from "sonner";
import { SKILLS_DATA, SkillData } from "@/data/skillsData";
import ReactMarkdown from "react-markdown";
import { downloadSkillZip, downloadAllSkillsZip } from "@/lib/claudeSkillExport";

type Status = "Ativo" | "Beta" | "Planejado";
type Categoria = "Código" | "IA" | "Dados" | "Criativo" | "Automação" | "Pesquisa" | "Infra" | "Outro" | "Pesquisa & Avatar" | "Copy & Persuasão" | "Inteligência Competitiva" | "Estratégia & Posicionamento" | "Vendas High-Ticket" | "Tráfego & Escala";

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
  Brain, Bomb, Target, MousePointer2, FileText, Swords, Shield, Megaphone, Video,
  "🧠": Brain, "💣": Bomb, "🕵️": Search, "⚗️": Sparkles,
  "🎯": Target, "♟️": Target, "🪤": MousePointer2, "📄": FileText,
  "⚔️": Swords, "🔍": Search, "🎭": Eye, "✍️": PenTool
};

const MARKETING_CATS = ["Pesquisa & Avatar", "Copy & Persuasão", "Inteligência Competitiva", "Estratégia & Posicionamento", "Vendas High-Ticket", "Tráfego & Escala"];
const TECH_CATS = ["Código", "IA", "Dados", "Criativo", "Automação", "Pesquisa", "Infra", "Outro"];

const SKILL_FILE_MAP: Record<string, string> = {
  "avatar-architect": "avatar-architect-v2.md",
  "devastador": "devastador-v4.md",
  "funnel-hacker": "funnel-hacker-v2.md",
  "mecanismo-unico": "mecanismo-unico-v2.md",
  "reposicionamento-estrategico": "reposicionamento-v2.md",
  "alquimia-escada-valor": "alquimia-escada-valor.md",
  "tripwire-matador": "tripwire-matador-v2.md",
  "lp-persuasiva": "lp-persuasiva-v2.md",
  "sales-architect": "sales-architect.md",
  "sales-closer": "sales-closer.md",
  "mapeamento-desejos": "mapeamento-desejos-v2.md",
  "dossie-problemas": "dossie-problemas-v2.md",
  "anams-copywriter": "anams-copywriter.md",
  "market-intel": "market-intel-v2.md",
  "yoshitani-traffic-scale": "yoshitani-traffic-scale.md",
};

const DEFAULT_SKILLS: Skill[] = [
  ...SKILLS_DATA.map(sd => ({
    id: sd.id, nome: sd.nome, descricao: sd.descricao,
    categoria: sd.categoria as Categoria, status: sd.status as Status,
    icone: sd.icone, is_default: true, system_prompt: sd.system_prompt,
    versao: sd.versao, gatilho: sd.gatilho, cor: sd.cor
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
  "Vendas High-Ticket": Shield, "Tráfego & Escala": Swords
};

const STATUS_STYLES: Record<Status, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Beta: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Planejado: "bg-muted text-muted-foreground border-border",
};

const ALL_CATS: Categoria[] = [...MARKETING_CATS, ...TECH_CATS] as Categoria[];
const ICON_NAMES = Object.keys(ICON_MAP).filter(k => !k.includes(' ') && !k.match(/[^\w]/));

export default function Skills() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Skill | null>(null);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", categoria: "Outro" as Categoria, status: "Ativo" as Status, icone: "Zap", system_prompt: "", versao: "", gatilho: "", cor: "#3b82f6" });
  const importRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("marketing");

  // Execute skill states
  const [showExecute, setShowExecute] = useState(false);
  const [executeSkill, setExecuteSkill] = useState<Skill | null>(null);
  const [execProjects, setExecProjects] = useState<any[]>([]);
  const [execProjectId, setExecProjectId] = useState("");
  const [execProduto, setExecProduto] = useState("");
  const [execModel, setExecModel] = useState("google/gemini-3-flash-preview");
  const [execExtra, setExecExtra] = useState("");
  const [execLoading, setExecLoading] = useState(false);
  const [execResult, setExecResult] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [execProdutos, setExecProdutos] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("imphq_skills").select("*").order("created_at").then(({ data }) => {
      setCustomSkills((data || []).map((s: any) => ({
        id: s.id, nome: s.nome, descricao: s.descricao,
        categoria: s.categoria as Categoria, status: s.status as Status,
        icone: s.icone || "Zap",
        system_prompt: s.system_prompt || "", versao: s.versao || "",
        gatilho: s.gatilho || "", cor: s.cor || "",
      })));
    });
  }, [user]);

  const allSkills = useMemo(() => [...DEFAULT_SKILLS, ...customSkills], [customSkills]);

  const tabSkills = useMemo(() => {
    const cats = activeTab === "marketing" ? MARKETING_CATS : TECH_CATS;
    return allSkills.filter(s => cats.includes(s.categoria));
  }, [allSkills, activeTab]);

  const filtered = useMemo(() => {
    return tabSkills.filter((s) => {
      if (busca && !s.nome.toLowerCase().includes(busca.toLowerCase()) && !s.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (catFiltro !== "all" && s.categoria !== catFiltro) return false;
      if (statusFiltro !== "all" && s.status !== statusFiltro) return false;
      return true;
    });
  }, [busca, catFiltro, statusFiltro, tabSkills]);

  const grouped = useMemo(() => {
    const map = new Map<Categoria, Skill[]>();
    for (const s of filtered) {
      if (!map.has(s.categoria)) map.set(s.categoria, []);
      map.get(s.categoria)!.push(s);
    }
    const cats = activeTab === "marketing" ? MARKETING_CATS : TECH_CATS;
    return (cats as Categoria[]).filter((c) => map.has(c)).map((c) => ({ categoria: c, skills: map.get(c)! }));
  }, [filtered, activeTab]);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", categoria: "Outro", status: "Ativo", icone: "Zap", system_prompt: "", versao: "", gatilho: "", cor: "#3b82f6" });
    setShowForm(true);
  };

  const openEdit = (e: React.MouseEvent, skill: Skill) => {
    e.stopPropagation();
    setEditing(skill);
    setForm({ nome: skill.nome, descricao: skill.descricao, categoria: skill.categoria, status: skill.status, icone: skill.icone, system_prompt: skill.system_prompt || "", versao: skill.versao || "", gatilho: skill.gatilho || "", cor: skill.cor || "#3b82f6" });
    setShowForm(true);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      // Collect all .md contents from files and zips
      const mdParts: { name: string; content: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          const mdFiles = Object.keys(zip.files).filter(f => f.endsWith(".md") && !zip.files[f].dir);
          for (const mf of mdFiles) {
            mdParts.push({ name: mf, content: await zip.files[mf].async("string") });
          }
        } else if (file.name.endsWith(".md")) {
          mdParts.push({ name: file.name, content: await file.text() });
        }
      }
      if (mdParts.length === 0) { toast.error("Nenhum .md encontrado"); return; }

      // Sort: largest file first (main prompt), rest as references
      mdParts.sort((a, b) => b.content.length - a.content.length);
      const mainPart = mdParts[0];
      let combined = mainPart.content;
      if (mdParts.length > 1) {
        for (let i = 1; i < mdParts.length; i++) {
          combined += `\n\n---\n\n## Referência: ${mdParts[i].name}\n\n${mdParts[i].content}`;
        }
      }
      const name = mainPart.name.replace(/\.md$/, "").replace(/[-_]/g, " ");
      setForm(prev => ({ ...prev, system_prompt: combined, nome: prev.nome || name }));
      toast.success(`Importado: ${mdParts.length} arquivo(s) .md`);
    } catch (err) { toast.error("Erro ao importar arquivo"); }
    if (importRef.current) importRef.current.value = "";
  };

  const saveSkill = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: form.nome, descricao: form.descricao, categoria: form.categoria,
      status: form.status, icone: form.icone,
      system_prompt: form.system_prompt || null, versao: form.versao || null,
      gatilho: form.gatilho || null, cor: form.cor || null,
    };
    if (editing) {
      const { error } = await supabase.from("imphq_skills").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      setCustomSkills(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s));
      toast.success("Skill atualizada!");
    } else {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("imphq_skills").insert([{ id, ...payload, owner_id: user?.id }]);
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

  const openExecute = (skill: Skill) => {
    setExecuteSkill(skill);
    setExecProjectId("");
    setExecProduto("");
    setExecExtra("");
    setExecResult("");
    setExecProdutos([]);
    setShowExecute(true);
    // Load projects
    supabase.from("imphq_projects").select("id, name, data").order("created_at", { ascending: false }).then(({ data }) => {
      setExecProjects(data || []);
    });
  };

  const onExecProjectChange = (pid: string) => {
    setExecProjectId(pid);
    setExecProduto("");
    const proj = execProjects.find((p: any) => p.id === pid);
    if (proj) {
      const d = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
      const prods = (d.produtos || []).map((p: any) => p.nome || p.name).filter(Boolean);
      setExecProdutos(prods);
    } else {
      setExecProdutos([]);
    }
  };

  const [lastOutputId, setLastOutputId] = useState<string | null>(null);
  const [feedbackVote, setFeedbackVote] = useState<string | null>(null);
  const [feedbackCorrection, setFeedbackCorrection] = useState("");

  const handleVoteFeedback = async (vote: "thumbs_up" | "thumbs_down") => {
    if (!lastOutputId || !executeSkill) return;
    setFeedbackVote(vote);
    const { error } = await supabase
      .from("imphq_skill_outputs")
      .update({ feedback: vote })
      .eq("id", lastOutputId);

    if (error) {
      toast.error("Falha ao salvar voto: " + error.message);
    } else {
      toast.success("Obrigado pelo feedback!");
      checkFeedbackAndRefine(executeSkill.id);
    }
  };

  const submitFeedbackText = async () => {
    if (!lastOutputId) return;
    const { error } = await supabase
      .from("imphq_skill_outputs")
      .update({ feedback_correction: feedbackCorrection })
      .eq("id", lastOutputId);

    if (error) {
      toast.error("Falha ao salvar comentário: " + error.message);
    } else {
      toast.success("Comentário salvo!");
    }
  };

  const checkFeedbackAndRefine = async (skillId: string) => {
    const { count, error } = await supabase
      .from("imphq_skill_outputs")
      .select("id", { count: "exact", head: true })
      .eq("skill_id", skillId)
      .not("feedback", "is", null)
      .eq("refined", false);

    if (!error && count && count >= 20) {
      toast.info("Atingimos 20 avaliações! A IA irá refinar automaticamente o System Prompt desta skill.");
      try {
        const { data, error: refErr } = await supabase.functions.invoke("openflow-ai", {
          body: {
            action: "refine_skill",
            skill_id: skillId,
          }
        });
        if (!refErr && data?.refined) {
          toast.success(`Skill evoluída com sucesso para a versão ${data.nextVersion}!`, {
            description: data.analise,
            duration: 10000,
          });
        }
      } catch (err) {
        console.error("Erro no refinamento da skill:", err);
      }
    }
  };

  const runExecuteSkill = async () => {
    if (!executeSkill) return;
    setExecLoading(true);
    setFeedbackVote(null);
    setFeedbackCorrection("");
    setLastOutputId(null);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "execute_skill",
          skill_id: executeSkill.id,
          skill_system_prompt: executeSkill.system_prompt,
          project_id: execProjectId || undefined,
          produto: execProduto || undefined,
          model: execModel,
          extra_instructions: execExtra || undefined,
        },
      });
      if (error) throw error;
      const result = data?.result || data?.error || "Sem resultado";
      setExecResult(result);
      setShowResult(true);

      const { data: outputData } = await supabase.from("imphq_skill_outputs").insert({
        project_id: execProjectId || null,
        skill_id: executeSkill.id,
        skill_nome: executeSkill.nome,
        result,
        model: execModel,
        extra_instructions: execExtra || null,
        produto: execProduto || null,
      }).select("id").maybeSingle();

      if (outputData) {
        setLastOutputId(outputData.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao executar skill");
    } finally {
      setExecLoading(false);
    }
  };

  const saveResultAsDoc = async () => {
    if (!execProjectId || !execResult) { toast.error("Selecione um projeto"); return; }
    const { error } = await supabase.from("imphq_docs").insert([{
      id: crypto.randomUUID(),
      project_id: execProjectId,
      title: `[IA] ${executeSkill?.nome || "Skill"} — ${new Date().toLocaleDateString("pt-BR")}`,
      body: execResult,
      cat: "skill-ia",
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo como documento no projeto!");
  };

  const getSkillTags = (skill: Skill): string[] => {
    const tags: string[] = [skill.categoria];
    if (skill.versao) tags.push(skill.versao);
    if (skill.status === "Beta") tags.push("Beta");
    return tags;
  };

  const currentFilterCats = activeTab === "marketing" ? MARKETING_CATS : TECH_CATS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">Skills & Engines <SectionInfo {...sectionHelpTexts.skills} /></h1>
          <p className="text-sm text-muted-foreground mt-1">{allSkills.filter(s => s.status === "Ativo").length} ativas · {allSkills.length} no arsenal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await downloadAllSkillsZip(allSkills);
                toast.success("Pacote pronto!", { description: "Arraste cada .zip em Claude → Settings → Capabilities → Skills" });
              } catch (e: any) {
                toast.error("Falha ao gerar pacote", { description: e.message });
              }
            }}
          >
            <Package className="h-4 w-4 mr-1" /> Exportar para Claude (.zip)
          </Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Skill</Button>
        </div>
      </div>

      {/* Tabs Marketing vs Técnicas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-secondary">
            <TabsTrigger value="marketing">🎯 Skills Marketing</TabsTrigger>
            <TabsTrigger value="tecnicas">⚙️ Skills Técnicas</TabsTrigger>
          </TabsList>
          <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
            {filtered.length} {activeTab === "marketing" ? "metodologias" : "ferramentas"}
          </span>
        </div>

        {/* Banner informativo */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15 mt-4">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {activeTab === "marketing"
              ? "Skills de Marketing são metodologias e engines de copy, pesquisa de avatar, inteligência competitiva e estratégia de posicionamento. Cada skill contém um System Prompt completo."
              : "Skills Técnicas são ferramentas de código, IA, dados, automação e infraestrutura que alimentam os fluxos operacionais do sistema."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Input placeholder="Buscar skill..." value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:max-w-xs bg-secondary/20" />
          <Select value={catFiltro} onValueChange={setCatFiltro}>
            <SelectTrigger className="sm:w-44 bg-secondary/20"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {currentFilterCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

        <TabsContent value="marketing" className="mt-0">
          <SkillGrid grouped={grouped} onDetail={setShowDetail} onEdit={openEdit} onDelete={deleteSkill} />
        </TabsContent>
        <TabsContent value="tecnicas" className="mt-0">
          <SkillGrid grouped={grouped} onDetail={setShowDetail} onEdit={openEdit} onDelete={deleteSkill} />
        </TabsContent>
      </Tabs>

      {/* DETALHE DA SKILL (RAIO-X) */}
      <Dialog open={!!showDetail} onOpenChange={(open) => !open && setShowDetail(null)}>
        <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden shadow-2xl">
          {showDetail && (
            <>
              <div className="h-2 w-full absolute top-0 left-0" style={{ backgroundColor: showDetail.cor || "#3b82f6" }} />
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                    style={{ backgroundColor: `${showDetail.cor || "#3b82f6"}20`, color: showDetail.cor || "#3b82f6" }}
                  >
                    {(() => { const Icon = ICON_MAP[showDetail.icone] || Zap; return <Icon className="w-6 h-6" />; })()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <DialogTitle className="text-2xl font-display font-bold tracking-tight">{showDetail.nome}</DialogTitle>
                      {showDetail.versao && (
                        <Badge variant="outline" className="font-mono text-xs text-muted-foreground bg-secondary/50 border-white/5">{showDetail.versao}</Badge>
                      )}
                      <Badge variant="outline" className={STATUS_STYLES[showDetail.status]}>{showDetail.status}</Badge>
                    </div>
                    <p className="text-sm text-foreground/70 leading-relaxed max-w-lg">{showDetail.descricao}</p>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <Badge variant="secondary" className="text-[10px]">{showDetail.categoria}</Badge>
                      {SKILL_FILE_MAP[showDetail.id] && (
                        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">{SKILL_FILE_MAP[showDetail.id]}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-6">
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

              {showDetail.system_prompt && (() => {
                  // Parse sections from the system prompt
                  const sections = parsePromptSections(showDetail.system_prompt);
                  const sectionIcons: Record<string, any> = {
                    "IDENTIDADE": Brain, "IDENTITY": Brain, "QUEM": Brain, "PERSONA": Brain,
                    "INSTRUÇÕES": FileText, "INSTRUCTIONS": FileText, "REGRAS": FileText, "RULES": FileText, "COMO": FileText,
                    "OUTPUT": Terminal, "SAÍDA": Terminal, "FORMATO": Terminal, "FORMAT": Terminal, "ENTREGA": Terminal,
                    "OBJETIVO": Target, "GOAL": Target, "MISSÃO": Target,
                    "CONTEXTO": Info, "CONTEXT": Info, "BACKGROUND": Info,
                  };
                  const getSectionIcon = (title: string) => {
                    const upper = title.toUpperCase().replace(/[#\s*→\-]/g, " ").trim();
                    for (const [key, icon] of Object.entries(sectionIcons)) {
                      if (upper.includes(key)) return icon;
                    }
                    return Bot;
                  };
                  const getSectionColor = (title: string) => {
                    const upper = title.toUpperCase();
                    if (upper.includes("IDENTIDADE") || upper.includes("IDENTITY") || upper.includes("PERSONA")) return "hsl(270 70% 60%)";
                    if (upper.includes("INSTRUÇÃO") || upper.includes("INSTRUCTION") || upper.includes("REGRA")) return "hsl(200 70% 55%)";
                    if (upper.includes("OUTPUT") || upper.includes("SAÍDA") || upper.includes("FORMATO")) return "hsl(150 60% 45%)";
                    if (upper.includes("OBJETIVO") || upper.includes("MISSÃO")) return "hsl(35 80% 55%)";
                    return showDetail.cor || "#3b82f6";
                  };

                  return (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5" /> System Prompt — {sections.length} seções
                      </span>

                      {/* Info Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "Seções", value: String(sections.length), icon: FileText },
                          { label: "Versão", value: showDetail.versao || "—", icon: Info },
                          { label: "Categoria", value: showDetail.categoria, icon: CATEGORIA_ICONS[showDetail.categoria] || Zap },
                          { label: "Gatilho", value: showDetail.gatilho ? "✓" : "—", icon: Terminal },
                        ].map((card, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 text-center">
                            <card.icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
                            <p className="text-sm font-semibold truncate">{card.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Section Index */}
                      <div className="flex flex-wrap gap-1 py-2 border-y border-border/30">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2 self-center">Índice:</span>
                        {sections.map((sec, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                            onClick={() => document.getElementById(`skill-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          >
                            {sec.title.replace(/^#+\s*/, "").slice(0, 25)}
                          </Badge>
                        ))}
                      </div>

                      {/* Collapsible Sections */}
                      <ScrollArea className="h-[400px] w-full rounded-md border border-white/10 bg-black/20 shadow-inner">
                        <div className="p-4 space-y-2">
                          {sections.map((sec, i) => {
                            const SectionIcon = getSectionIcon(sec.title);
                            const sectionColor = getSectionColor(sec.title);
                            const cleanTitle = sec.title.replace(/^#+\s*/, "");
                            return (
                              <details key={i} id={`skill-section-${i}`} open={i === 0} className="group/section rounded-lg border border-white/5 bg-black/20 overflow-hidden">
                                <summary
                                  className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors select-none list-none [&::-webkit-details-marker]:hidden"
                                >
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${sectionColor}20`, color: sectionColor }}>
                                    <SectionIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-sm font-semibold flex-1">{cleanTitle}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{sec.content.split("\n").length} linhas</span>
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open/section:rotate-90" />
                                </summary>
                                <div className="px-4 pb-4 border-t border-white/5">
                                  <div className="prose prose-invert prose-sm max-w-none mt-3 prose-headings:text-primary prose-headings:font-display prose-strong:text-foreground prose-code:text-emerald-400 prose-code:bg-secondary/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-table:border-collapse prose-th:bg-secondary/30 prose-th:border prose-th:border-white/10 prose-th:px-3 prose-th:py-1.5 prose-td:border prose-td:border-white/10 prose-td:px-3 prose-td:py-1.5 prose-li:marker:text-primary/60">
                                    <ReactMarkdown>{sec.content}</ReactMarkdown>
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2">
                  {showDetail.system_prompt && (
                    <Button onClick={() => { setShowDetail(null); openExecute(showDetail); }} className="gap-1.5">
                      <Play className="h-4 w-4" /> Executar com IA
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowDetail(null)}>Fechar</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* FORM DE NOVA SKILL */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Skill" : "Nova Skill"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {/* Import button */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/15">
              <input ref={importRef} type="file" accept=".md,.zip" multiple onChange={handleImportFile} className="hidden" />
              <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="gap-1">
                <Plus className="h-3 w-3" /> Importar .md / .zip (múltiplos)
              </Button>
              <span className="text-[10px] text-muted-foreground">Importa o system prompt de um arquivo .md ou .zip contendo .md</span>
            </div>

            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Avatar Architect" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="O que essa skill faz..." rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v as Categoria })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Versão</Label>
                <Input value={form.versao} onChange={e => setForm({ ...form, versao: e.target.value })} placeholder="V2.0" />
              </div>
              <div>
                <Label>Gatilho</Label>
                <Input value={form.gatilho} onChange={e => setForm({ ...form, gatilho: e.target.value })} placeholder="[Nicho] e [Avatar]" />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                  <Input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} className="flex-1" />
                </div>
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
            <div>
              <Label>System Prompt</Label>
              <Textarea value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} placeholder="Cole aqui o system prompt completo da skill (markdown)..." rows={8} className="font-mono text-xs" />
              {form.system_prompt && <p className="text-[10px] text-muted-foreground mt-1">{form.system_prompt.split("\n").length} linhas · {form.system_prompt.length} chars</p>}
            </div>
          </div>
          <DialogFooter><Button onClick={saveSkill}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXECUTE SKILL DIALOG */}
      <Dialog open={showExecute} onOpenChange={setShowExecute}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Executar: {executeSkill?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projeto</Label>
              <Select value={execProjectId} onValueChange={onExecProjectChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto..." /></SelectTrigger>
                <SelectContent>{execProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {execProdutos.length > 0 && (
              <div>
                <Label>Produto</Label>
                <Select value={execProduto} onValueChange={setExecProduto}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                  <SelectContent>{execProdutos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Modelo</Label>
              <Select value={execModel} onValueChange={setExecModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-3-flash-preview">Gemini Flash</SelectItem>
                  <SelectItem value="openai/gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="anthropic/claude-opus-4">Claude Opus 4</SelectItem>
                  <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                  <SelectItem value="moonshotai/kimi-k2">Kimi K2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instruções adicionais (opcional)</Label>
              <Textarea value={execExtra} onChange={e => setExecExtra(e.target.value)} placeholder="Ex: Foque nos 3 pilares do método..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExecute(false)}>Cancelar</Button>
            <Button onClick={runExecuteSkill} disabled={execLoading} className="gap-1.5">
              {execLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {execLoading ? "Gerando..." : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESULT DIALOG */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Resultado — {executeSkill?.nome}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="prose prose-invert prose-sm max-w-none p-4">
              <ReactMarkdown>{execResult}</ReactMarkdown>
            </div>
          </ScrollArea>

          {/* Seção de Feedback */}
          {lastOutputId && (
            <div className="border-t border-border/40 p-4 bg-secondary/10 flex flex-col gap-2 rounded-b-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">O que achou do resultado?</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={feedbackVote === "thumbs_up" ? "default" : "outline"}
                    className={feedbackVote === "thumbs_up" ? "bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" : "h-8 text-xs"}
                    onClick={() => handleVoteFeedback("thumbs_up")}
                  >
                    👍 Bom
                  </Button>
                  <Button
                    size="sm"
                    variant={feedbackVote === "thumbs_down" ? "default" : "outline"}
                    className={feedbackVote === "thumbs_down" ? "bg-red-600 hover:bg-red-700 h-8 text-xs" : "h-8 text-xs"}
                    onClick={() => handleVoteFeedback("thumbs_down")}
                  >
                    👎 Ruim
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Sugestões de melhoria ou correção (opcional)..."
                  value={feedbackCorrection}
                  onChange={e => setFeedbackCorrection(e.target.value)}
                  className="h-8 text-xs bg-background/50 flex-1"
                />
                <Button size="sm" onClick={submitFeedbackText} className="h-8 text-xs">
                  Enviar Observação
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-border/40 gap-2">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(execResult); toast.success("Copiado!"); }} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            {execProjectId && (
              <Button variant="outline" size="sm" onClick={saveResultAsDoc} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Salvar como Doc
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Parse prompt into collapsible sections ── */
function parsePromptSections(prompt: string): { title: string; content: string }[] {
  const lines = prompt.split("\n");
  const sections: { title: string; content: string }[] = [];
  let currentTitle = "Introdução";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line) || /^---+$/.test(line)) {
      if (currentLines.length > 0 || sections.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
        currentLines = [];
      }
      if (/^---+$/.test(line)) {
        currentTitle = "───";
      } else {
        currentTitle = line;
      }
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }
  // Filter empty sections
  return sections.filter(s => s.content.length > 0);
}

/* ── Skill Grid Sub-component ── */
function SkillGrid({ grouped, onDetail, onEdit, onDelete }: {
  grouped: { categoria: Categoria; skills: Skill[] }[];
  onDetail: (s: Skill) => void;
  onEdit: (e: React.MouseEvent, s: Skill) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  if (grouped.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma skill encontrada.</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      {grouped.map(({ categoria, skills }) => {
        const CatIcon = CATEGORIA_ICONS[categoria] || Zap;
        return (
          <div key={categoria} className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <CatIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{categoria}</h2>
              <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{skills.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => {
                const Icon = ICON_MAP[skill.icone] || Zap;
                const skillColor = skill.cor || "#3b82f6";
                const fileName = SKILL_FILE_MAP[skill.id];
                return (
                  <Card
                    key={skill.id}
                    className="group cursor-pointer hover:border-primary/50 hover:bg-secondary/10 transition-all duration-300 relative overflow-hidden h-full flex flex-col"
                    onClick={() => onDetail(skill)}
                  >
                    {skill.cor && <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: skillColor }} />}
                    <CardContent className="p-4 sm:p-5 flex flex-col flex-1 gap-3 relative z-10">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg p-2 flex items-center justify-center shrink-0" style={{ backgroundColor: `${skillColor}20`, color: skillColor }}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-[15px] text-foreground block">{skill.nome}</span>
                            {fileName && <span className="text-[10px] font-mono text-muted-foreground/60 block">{fileName}</span>}
                            {skill.versao && !fileName && <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{skill.versao}</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className={`${STATUS_STYLES[skill.status]} text-[10px] px-1.5 py-0`}>{skill.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">{skill.descricao}</p>

                      {/* Tags + Ler button */}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{skill.categoria}</Badge>
                          {skill.versao && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono">{skill.versao}</Badge>}
                        </div>
                        {skill.system_prompt && (
                          <span className="text-[10px] text-primary font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            Ler <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md shadow-sm border p-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Baixar para Claude Desktop"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await downloadSkillZip(skill);
                              toast.success("Skill baixada!", { description: "Arraste em Claude → Settings → Capabilities → Skills" });
                            } catch (err: any) {
                              toast.error("Falha no download", { description: err.message });
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {!skill.is_default && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => onEdit(e, skill)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={(e) => onDelete(e, skill.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
