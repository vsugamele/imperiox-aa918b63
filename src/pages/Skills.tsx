import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Code2, Bot, Database, Palette, Zap, Search, Server,
  Github, Terminal, Sparkles, Eye, AudioLines, PenTool,
  Sheet, CloudSun, BarChart3, ShoppingCart, Banana, ImagePlus,
  Film, FrameIcon, Send, Youtube, Globe, HeartPulse,
} from "lucide-react";

type Status = "Ativo" | "Beta" | "Planejado";
type Categoria = "Código" | "IA" | "Dados" | "Criativo" | "Automação" | "Pesquisa" | "Infra";

interface Skill {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  status: Status;
  icone: React.ElementType;
}

const SKILLS: Skill[] = [
  { id: "coding-agent", nome: "Coding Agent", descricao: "Agente de codificação autônomo para tarefas de desenvolvimento", categoria: "Código", status: "Ativo", icone: Code2 },
  { id: "github-issues", nome: "GitHub Issues", descricao: "Criação e gestão de issues no GitHub automaticamente", categoria: "Código", status: "Ativo", icone: Github },
  { id: "github-cli", nome: "GitHub CLI", descricao: "Interação com repositórios via linha de comando", categoria: "Código", status: "Ativo", icone: Terminal },
  { id: "skill-creator", nome: "Skill Creator", descricao: "Criador de novas skills para o sistema de agentes", categoria: "Código", status: "Beta", icone: Sparkles },

  { id: "gemini-flash", nome: "Gemini Flash", descricao: "Modelo de linguagem rápido do Google para tarefas gerais", categoria: "IA", status: "Ativo", icone: Sparkles },
  { id: "image-vision", nome: "Image Vision", descricao: "Análise e interpretação de imagens com IA", categoria: "IA", status: "Ativo", icone: Eye },
  { id: "whisper-api", nome: "Whisper API", descricao: "Transcrição de áudio para texto com alta precisão", categoria: "IA", status: "Ativo", icone: AudioLines },
  { id: "copy-engine", nome: "Copy Engine", descricao: "Geração de copies persuasivas para marketing", categoria: "IA", status: "Beta", icone: PenTool },

  { id: "google-sheets", nome: "Google Sheets", descricao: "Leitura e escrita em planilhas do Google", categoria: "Dados", status: "Ativo", icone: Sheet },
  { id: "weather", nome: "Weather", descricao: "Dados meteorológicos em tempo real", categoria: "Dados", status: "Ativo", icone: CloudSun },
  { id: "meta-ads-api", nome: "Meta Ads API", descricao: "Métricas e gestão de campanhas Meta Ads", categoria: "Dados", status: "Beta", icone: BarChart3 },
  { id: "hotmart-api", nome: "Hotmart API", descricao: "Dados de vendas e assinaturas da Hotmart", categoria: "Dados", status: "Ativo", icone: ShoppingCart },

  { id: "nano-banana-pro", nome: "Nano Banana Pro", descricao: "Geração de imagens estilizadas para redes sociais", categoria: "Criativo", status: "Ativo", icone: Banana },
  { id: "openai-image-gen", nome: "OpenAI Image Gen", descricao: "Geração de imagens com DALL-E e GPT Image", categoria: "Criativo", status: "Ativo", icone: ImagePlus },
  { id: "remotion", nome: "Remotion", descricao: "Renderização programática de vídeos", categoria: "Criativo", status: "Beta", icone: Film },
  { id: "video-frames", nome: "Video Frames", descricao: "Extração e análise de frames de vídeo", categoria: "Criativo", status: "Planejado", icone: FrameIcon },

  { id: "telegram-bot", nome: "Telegram Bot", descricao: "Bot para comunicação e automações no Telegram", categoria: "Automação", status: "Ativo", icone: Send },

  { id: "youtube", nome: "YouTube", descricao: "Busca e análise de conteúdos no YouTube", categoria: "Pesquisa", status: "Ativo", icone: Youtube },
  { id: "market-scraper", nome: "Market Scraper", descricao: "Coleta de dados de mercado e concorrentes", categoria: "Pesquisa", status: "Beta", icone: Globe },

  { id: "healthcheck", nome: "Healthcheck", descricao: "Monitoramento de saúde dos serviços e APIs", categoria: "Infra", status: "Ativo", icone: HeartPulse },
];

const CATEGORIA_ICONS: Record<Categoria, React.ElementType> = {
  "Código": Code2,
  "IA": Bot,
  "Dados": Database,
  "Criativo": Palette,
  "Automação": Zap,
  "Pesquisa": Search,
  "Infra": Server,
};

const STATUS_STYLES: Record<Status, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Beta: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Planejado: "bg-muted text-muted-foreground border-border",
};

const CATEGORIAS: Categoria[] = ["Código", "IA", "Dados", "Criativo", "Automação", "Pesquisa", "Infra"];

export default function Skills() {
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");

  const filtered = useMemo(() => {
    return SKILLS.filter((s) => {
      if (busca && !s.nome.toLowerCase().includes(busca.toLowerCase()) && !s.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (catFiltro !== "all" && s.categoria !== catFiltro) return false;
      if (statusFiltro !== "all" && s.status !== statusFiltro) return false;
      return true;
    });
  }, [busca, catFiltro, statusFiltro]);

  const grouped = useMemo(() => {
    const map = new Map<Categoria, Skill[]>();
    for (const s of filtered) {
      if (!map.has(s.categoria)) map.set(s.categoria, []);
      map.get(s.categoria)!.push(s);
    }
    return CATEGORIAS.filter((c) => map.has(c)).map((c) => ({ categoria: c, skills: map.get(c)! }));
  }, [filtered]);

  const ativos = SKILLS.filter((s) => s.status === "Ativo").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Skills & Capacidades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ativos} ativos · {SKILLS.length} total
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar skill..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
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
        const CatIcon = CATEGORIA_ICONS[categoria];
        return (
          <div key={categoria} className="space-y-3">
            <div className="flex items-center gap-2">
              <CatIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{categoria}</h2>
              <span className="text-xs text-muted-foreground">({skills.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {skills.map((skill) => {
                const Icon = skill.icone;
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
                        <Badge variant="outline" className={STATUS_STYLES[skill.status]}>
                          {skill.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{skill.descricao}</p>
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
