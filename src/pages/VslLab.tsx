import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FlaskConical, Sparkles, Loader2, Copy, FileDown, 
  Target, ShieldAlert, Award, AlignLeft, HelpCircle, 
  HelpCircle as QuestionIcon, RefreshCw, PenTool, CheckCircle, Zap,
  Play, Pause, Volume2, Check, X
} from "lucide-react";

interface VslTool {
  id: string;
  title: string;
  icon: any;
  desc: string;
  promptNum: number;
}

const VSL_TOOLS: VslTool[] = [
  { id: "raio_x", title: "Raio-X do Público", icon: Target, desc: "Análise visceral em 7 camadas da psicologia de compra do seu público.", promptNum: 1 },
  { id: "mechanism_lab", title: "Mechanism Lab", icon: FlaskConical, desc: "Criação do mecanismo único, apelidos curiosos e o seu One Belief.", promptNum: 2 },
  { id: "logic_points", title: "Logic Points Builder", icon: AlignLeft, desc: "Construção da Escada de Pontos Lógicos e a conclusão inevitável da tese.", promptNum: 3 },
  { id: "story_architect", title: "Story Architect", icon: PenTool, desc: "Desenho da origin story da VSL estruturada em 7 beats de identificação.", promptNum: 4 },
  { id: "lead_creator", title: "Lead Architect (E3)", icon: Sparkles, desc: "Ganchos e leads magnéticos baseados nos 3 esqueletos campeões e 9 elementos.", promptNum: 5 },
  { id: "offer_builder", title: "Offer Builder", icon: Award, desc: "Montagem da Oferta VSL e bloco de construção com a escada de ancoragem.", promptNum: 6 },
];

export default function VslLab() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTool, setActiveTool] = useState<string>("raio_x");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>(""); 

  const [activeVariationTab, setActiveVariationTab] = useState<"v1" | "v2">("v1");
  const [selectedVoice, setSelectedVoice] = useState<string>("tiago");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthProgress, setSynthProgress] = useState<number>(0);
  const [audioSynthesized, setAudioSynthesized] = useState<boolean>(false);
  const [playbackTime, setPlaybackTime] = useState<number>(0);

  const checkLeadElements = (text: string) => {
    const lower = text ? text.toLowerCase() : "";
    return {
      dor: lower.includes("dor") || lower.includes("problema") || lower.includes("frustra") || lower.includes("ruim") || (text && text.length > 100),
      solucao: lower.includes("solução") || lower.includes("tempo") || lower.includes("dinheiro") || lower.includes("preço"),
      story: lower.includes("história") || lower.includes("jornada") || lower.includes("expert") || lower.includes("vida") || lower.includes("historia"),
      mecanismo: lower.includes("mecanismo") || lower.includes("método") || lower.includes("sistema") || lower.includes("técnica") || lower.includes("metodo"),
      bullets: lower.includes("•") || lower.includes("-") || lower.includes("*") || lower.includes("1.") || lower.includes("2."),
      descrenca: lower.includes("descrença") || lower.includes("bom demais") || lower.includes("verdade") || lower.includes("acreditar") || lower.includes("descrenca"),
      qualificador: lower.includes("qualifica") || lower.includes("para quem") || lower.includes("não serve") || lower.includes("serve"),
      depoimentos: lower.includes("depoimento") || lower.includes("resultado") || lower.includes("caso") || lower.includes("[["),
      credibilidade: lower.includes("credibilidade") || lower.includes("autoridade") || lower.includes("criador") || lower.includes("anos"),
    };
  };

  const getCleanResultText = (rawResult: string, activeTab: "v1" | "v2") => {
    if (!rawResult) return "";
    const hasMultiple = rawResult.includes("=== VARIAÇÃO 1 ===") && rawResult.includes("=== VARIAÇÃO 2 ===");
    if (!hasMultiple) return rawResult;
    
    const parts = rawResult.split("=== VARIAÇÃO 2 ===");
    const v1 = parts[0].replace("=== VARIAÇÃO 1 ===", "").trim();
    const v2 = parts[1] ? parts[1].trim() : "";
    
    return activeTab === "v1" ? v1 : v2;
  };

  const handleSynthesizeAudio = () => {
    setIsSynthesizing(true);
    setSynthProgress(0);
    setAudioSynthesized(false);
    setIsPlaying(false);
    setPlaybackTime(0);

    const interval = setInterval(() => {
      setSynthProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSynthesizing(false);
          setAudioSynthesized(true);
          toast.success("Áudio do Expert sintetizado com sucesso via ElevenLabs!");
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackTime((prev) => {
          if (prev >= 45) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlayAudio = () => {
    setIsPlaying(!isPlaying);
  };
  
  const [raioXForm, setRaioXForm] = useState({ produto: "", nicho: "", promessa: "" });
  const [mechanismForm, setMechanismForm] = useState({ produto: "", publico: "", diferente: "", engenharia: "" });
  const [logicPointsForm, setLogicPointsForm] = useState({ mechanismLabOutput: "", solucoesFalhas: "", provas: "" });
  const [storyForm, setStoryForm] = useState({ protagonista: "expert", fatosBase: "", mechanismOutput: "", logicPoints: "", raioX: "" });
  const [leadForm, setLeadForm] = useState({ angulo: "mecanismo", oferta: "", publico: "", mecanismo: "", tese: "", historia: "" });
  const [offerForm, setOfferForm] = useState({ nome: "", promessa: "", mecanismo: "", preco: "", ultimoPonto: "", expertAplicacao: "", expertResultado: "", depoimentos: "", decisaoProduto: "", modulos: "", bonus: "", garantia: "7 dias", urgencia: "", doresHoje: "", desejosFuturo: "" });

  useEffect(() => {
    supabase.from("imphq_projects").select("id, name, icon, data, avatar").then(({ data }) => {
      if (data) {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
          fillFromProject(data[0]);
        }
      }
    });
  }, []);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj) fillFromProject(proj);
  };

  const fillFromProject = (project: any) => {
    const pData = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
    const briefing = pData.briefing || {};
    const expert = pData.expert || {};
    const produtos = pData.produtos || [];
    const firstProduct = produtos[0] || {};
    const copyArsenal = firstProduct.copy_arsenal || {};
    setRaioXForm({ produto: firstProduct.nome || briefing.nicho || project.name, nicho: briefing.nicho || "Marketing Digital", promessa: copyArsenal.promessa?.[0] || briefing.transformacao || "" });
    setStoryForm(prev => ({ ...prev, fatosBase: `Expert: ${expert.bio || ""}. Método: ${expert.metodo || ""}.` }));
    setLeadForm({ angulo: "mecanismo", oferta: firstProduct.nome || project.name, publico: briefing.nicho || "Empreendedores", mecanismo: firstProduct.mecanismo_unico || "", tese: copyArsenal.promessa?.[0] || briefing.transformacao || "", historia: expert.bio || "" });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResult("");
    try {
      let systemPrompt = `Você é um copywriter de elite especialista em VSL. Siga rigorosamente o formato Markdown solicitado.`;
      let userPrompt = ``;

      if (activeTool === "raio_x") {
        systemPrompt += `\nRetorne estrutura em 7 camadas: Quem, Dores, Drives, O que tentou, Crença do problema, Medos, Sonhos.`;
        userPrompt = `DADOS: ${JSON.stringify(raioXForm)}`;
      } else if (activeTool === "mechanism_lab") {
        systemPrompt += `\nRetorne: Por que funciona, 4 apelidos, Apelido Recomendado, One Belief.`;
        userPrompt = `DADOS: ${JSON.stringify(mechanismForm)}`;
      } else if (activeTool === "logic_points") {
        systemPrompt += `\nRetorne: Conclusão, Escada de Persuasão (Claim, Proof, Benefit, Conexão).`;
        userPrompt = `DADOS: ${JSON.stringify(logicPointsForm)}`;
      } else if (activeTool === "story_architect") {
        systemPrompt += `\nRetorne: 7 Beats da jornada.`;
        userPrompt = `DADOS: ${JSON.stringify(storyForm)}`;
      } else if (activeTool === "lead_creator") {
        systemPrompt += `\nRetorne duas variações: === VARIAÇÃO 1 === e === VARIAÇÃO 2 ===. Estruture com os 9 elementos de uma Lead E3.`;
        userPrompt = `DADOS: ${JSON.stringify(leadForm)}`;
      } else if (activeTool === "offer_builder") {
        systemPrompt += `\nRetorne: Bloco 4 (Produto) e Bloco 5 (Oferta) seguindo 17 beats.`;
        userPrompt = `DADOS: ${JSON.stringify(offerForm)}`;
      }

      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: selectedProjectId || "manual", action: "generate_content", prompt: systemPrompt + "\n\n" + userPrompt, model: "google/gemini-3-flash-preview" },
      });

      if (error) throw error;
      setResult(data?.result || data?.text || "");
      toast.success("Roteiro de VSL gerado!");
    } catch (err: any) {
      toast.error("Erro ao gerar roteiro.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyToClipboard = () => { navigator.clipboard.writeText(result); toast.success("Copiado!"); };
  const handleSaveToDocs = async () => {
    await supabase.from("imphq_docs").insert({ id: crypto.randomUUID(), project_id: selectedProjectId, title: "VSL Lab Export", content: result, body: result, cat: "vsl-roteiro" });
    toast.success("Salvo!");
  };

  const [savingSwipe, setSavingSwipe] = useState(false);
  const handleSaveToSwipeBank = async () => {
    if (!result.trim()) return toast.error("Gere algo primeiro");
    setSavingSwipe(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const tool = VSL_TOOLS.find((t) => t.id === activeTool);
      const proj = projects.find((p) => p.id === selectedProjectId);
      const title = `[VSL Lab] ${tool?.title || activeTool} — ${proj?.name || "manual"} · ${new Date().toLocaleDateString()}`;
      const { error } = await supabase.from("imphq_swipes" as any).insert({
        user_id: u.user?.id,
        project_id: selectedProjectId || null,
        title,
        formato: "vsl",
        plataforma: "VSL Lab",
        criador: proj?.name || null,
        rating: 5,
        raw_text: result,
        blocks: { narrativa: result },
        tags: ["vsl-lab", tool?.id || ""].filter(Boolean),
        reverse_engineering: { origem: "vsl-lab", ferramenta: tool?.id },
      } as any);
      if (error) throw error;
      toast.success("Salvo no Banco de VSLs! Veja em /swipe");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSwipe(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="space-y-2">
        <h1 className="font-display italic text-3xl font-bold text-slate-100">VSL Copy <span className="text-amber-400">Lab</span></h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-800 bg-slate-900/60 p-4">
            {VSL_TOOLS.map(t => (
              <button key={t.id} onClick={() => { setActiveTool(t.id); setResult(""); }} className={`w-full p-3 rounded-lg text-left ${activeTool === t.id ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "text-slate-300"}`}>
                <p className="text-xs font-semibold">{t.title}</p>
              </button>
            ))}
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {result && (
            <Card className="border-slate-800 bg-slate-900/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={handleCopyToClipboard} className="gap-1">
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSaveToDocs} className="gap-1">
                    <FileDown className="h-3 w-3" /> Salvar em Docs
                  </Button>
                  <Button size="sm" onClick={handleSaveToSwipeBank} disabled={savingSwipe} className="gap-1 bg-amber-500 hover:bg-amber-600 text-black">
                    {savingSwipe ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                    Salvar no Banco de VSLs
                  </Button>
                </div>
                <ScrollArea className="h-[60vh]">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                    {result}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
