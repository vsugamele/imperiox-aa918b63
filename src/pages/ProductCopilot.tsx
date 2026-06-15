import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ProdutoTabs } from "@/components/produto/ProdutoTabs";
import { 
  Brain, Send, Sparkles, FolderOpen, Save, FileDown, 
  RefreshCw, ChevronRight, PenTool, Award, Lightbulb, 
  MessageSquare, Loader2, PlusCircle, Wrench
} from "lucide-react";
import { COPILOT_FRAMEWORKS } from "@/data/copilotFrameworks";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ProductDossier {
  nome: string;
  nicho: string;
  tom_voz: string;
  arquetipo: string;
  manifesto: string;
  one_belief: string;
  mecanismo_nome: string;
  mecanismo_claim: string;
  logic_points: string;
  preco: string;
  bonus: string;
  ancoragem: string;
  garantia: string;
  vsl_hook: string;
  vsl_beats: string;
  ad_angles: string;
}

const emptyDossier: ProductDossier = {
  nome: "",
  nicho: "",
  tom_voz: "",
  arquetipo: "explorador",
  manifesto: "",
  one_belief: "",
  mecanismo_nome: "",
  mecanismo_claim: "",
  logic_points: "",
  preco: "",
  bonus: "",
  ancoragem: "",
  garantia: "7 dias",
  vsl_hook: "",
  vsl_beats: "",
  ad_angles: "",
};

export default function ProductCopilot() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("branding");
  
  // Dossier state
  const [dossier, setDossier] = useState<ProductDossier>(emptyDossier);
  
  // New project dialog state
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState("infoproduto");
  const [savingProject, setSavingProject] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from("imphq_projects")
      .select("id, name, icon, data, avatar")
      .eq("is_archived", false)
      .order("name");
    setProjects(data || []);
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load selected project data into dossier
  useEffect(() => {
    if (selectedProjectId === "none") {
      setDossier(emptyDossier);
      setMessages([]);
      return;
    }

    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj) {
      const d = typeof proj.data === "string" ? (() => { try { return JSON.parse(proj.data); } catch { return {}; } })() : (proj.data || {});
      const av = proj.avatar || {};
      
      const loadedDossier: ProductDossier = {
        nome: d.produto || proj.name || "",
        nicho: d.briefing?.nicho || d.category || "",
        tom_voz: d.branding?.tom_de_voz || "",
        arquetipo: d.branding?.arquetipo || "explorador",
        manifesto: d.branding?.manifesto || "",
        one_belief: d.copy_arsenal?.one_belief || av.crenca_necessaria || "",
        mecanismo_nome: d.copy_arsenal?.metodo_simplificado?.[0] || d.mecanismo_unico || "",
        mecanismo_claim: d.copy_arsenal?.oportunidade?.[0] || "",
        logic_points: d.copy_arsenal?.logic_points || "",
        preco: d.precos?.principal || "",
        bonus: d.produtos_bonus || "",
        ancoragem: d.copy_arsenal?.ancoragem || "",
        garantia: d.precos?.garantia || "7 dias",
        vsl_hook: d.copy_arsenal?.vsl_hook || "",
        vsl_beats: d.copy_arsenal?.vsl_beats || "",
        ad_angles: d.copy_arsenal?.ad_angles || "",
      };
      
      setDossier(loadedDossier);
      
      // Welcome message in chat with context
      setMessages([
        {
          role: "assistant",
          content: `Carreguei o projeto **${proj.icon || "📁"} ${proj.name}**! Já recuperei os dados de avatar e branding existentes do banco de dados. Como posso te ajudar a refinar ou criar o roteiro de vendas hoje?`
        }
      ]);
    }
  }, [selectedProjectId, projects]);

  // Handle manual field change in dossier
  const handleFieldChange = (field: keyof ProductDossier, value: string) => {
    setDossier((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to construct system prompt
  const buildSystemPrompt = () => {
    let context = `Você é o Copilot de Criação de Produtos da Imperio HQ — um estrategista de negócios digitais de elite e copywriter de resposta direta.
Seu objetivo é ajudar o usuário a estruturar um produto do zero ou refinar um produto existente de forma contundente e lucrativa.

### FRAMEWORKS DE PERSUASÃO E MARKETING (APLIQUE OBRIGATORIAMENTE):
1. **Estrutura de VSL em 7 Blocos**:
${COPILOT_FRAMEWORKS.vsl.blocks.map(b => `- Bloco ${b.num}: ${b.title} (${b.description}) -> REGRA: ${b.rule}`).join("\n")}

2. **Equação de Valor Grand Slam**:
- Fórmula: ${COPILOT_FRAMEWORKS.valueEquation.formula}
- Regras: ${COPILOT_FRAMEWORKS.valueEquation.rules.join(" | ")}

3. **Estrutura de Sales Page**:
- Blocos: ${COPILOT_FRAMEWORKS.salesPage.blocks.join(" -> ")}

4. **Camadas do Avatar**:
- C1 Sintomas, C2 Dores Conscientes, C3 Ego Ferido (desejos tabus), C4 Trauma.

5. **Ângulos de Anúncios**:
${COPILOT_FRAMEWORKS.adAngles.map(a => `- ${a.name}: ${a.focus}`).join("\n")}
`;

    if (selectedProjectId !== "none") {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        context += `\n\n### CONTEXTO DO PROJETO SELECIONADO:
- Nome do Projeto: ${proj.name}
- Produto Atual: ${dossier.nome || "Não definido"}
- Nicho/Categoria: ${dossier.nicho || "Não definido"}
`;
      }
    }

    context += `\n\n### INSTRUÇÃO CRÍTICA DE RETORNO (JSON SYNC):
Sempre que você gerar, sugerir ou atualizar informações do dossiê (nomes, manifesto, mecanismo, preços, bônus, VSL ou ganchos), forneça uma explicação persuasiva e estratégica em markdown para o usuário no chat. 
No FINAL da sua mensagem, você DEVE anexar um bloco JSON envolto pela tag \`\`\`json-copilot contendo todos os campos do dossiê atualizados. NÃO altere os campos que o usuário não mencionou ou que já estão corretos. Exemplo de formato:
\`\`\`json-copilot
{
  "nome": "...",
  "nicho": "...",
  "tom_voz": "...",
  "arquetipo": "...",
  "manifesto": "...",
  "one_belief": "...",
  "mecanismo_nome": "...",
  "mecanismo_claim": "...",
  "logic_points": "...",
  "preco": "...",
  "bonus": "...",
  "ancoragem": "...",
  "garantia": "...",
  "vsl_hook": "...",
  "vsl_beats": "...",
  "ad_angles": "..."
}
\`\`\`

Seja magnético, contundente, pragmático e muito específico. Responda sempre em Português do Brasil.`;

    return context;
  };

  // Send message to IA
  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || sending) return;

    if (!customPrompt) setInput("");
    setSending(true);

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: textToSend }];
    setMessages(newMessages);

    try {
      const systemPrompt = buildSystemPrompt();
      const payload = {
        messages: [
          { role: "system", content: systemPrompt },
          ...newMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        model: "openai/gpt-4o-mini",
      };

      const { data, error } = await supabase.functions.invoke("chat-with-ai", { body: payload });
      if (error) throw error;

      const reply = data?.choices?.[0]?.message?.content || data?.content || "";
      
      // Parse potential json-copilot block to update dossier state
      parseCopilotJson(reply);

      // Remove the json block from display if desired, or keep it. Let's clean the chat UI from the raw json block
      const cleanedReply = reply.replace(/```json-copilot[\s\S]*?```/g, "").trim();

      setMessages((prev) => [...prev, { role: "assistant", content: cleanedReply }]);
    } catch (e: any) {
      toast.error("Erro na comunicação com a IA: " + (e.message || "tente novamente"));
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Erro ao obter resposta. Verifique a conexão com a Edge Function." }]);
    } finally {
      setSending(false);
    }
  };

  // Parse json-copilot tag and update form state
  const parseCopilotJson = (text: string) => {
    try {
      const match = text.match(/```json-copilot([\s\S]*?)```/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1].trim());
        setDossier((prev) => ({
          ...prev,
          ...parsed
        }));
        toast.success("Dossiê atualizado pela IA!");
      }
    } catch (e) {
      console.error("Failed to parse sync JSON from AI", e);
    }
  };

  // Fast action triggers
  const triggerFastAction = (type: string) => {
    let prompt = "";
    if (type === "naming") {
      prompt = "Com base no nosso chat, me sugira 3 nomes altamente magnéticos para o produto e crie o manifesto/branding básico dele (tom de voz, posicionamento e arquétipo). Preencha o bloco json-copilot.";
      setActiveTab("branding");
    } else if (type === "mecanismo") {
      prompt = "Crie o mecanismo único para esse produto, definindo a One Belief (crença que destrava a venda), o nome do método/mecanismo e o claim central de como ele resolve a dor profunda.";
      setActiveTab("mecanismo");
    } else if (type === "oferta") {
      prompt = "Desenhe a oferta Grand Slam para esse produto. Sugira o preço, o stack de bônus agressivos, a escada de ancoragem e o formato de garantia. Preencha o json-copilot.";
      setActiveTab("oferta");
    } else if (type === "vsl") {
      prompt = "Estruture o roteiro VSL deste produto. Crie o gancho de entrada do primeiro minuto (vsl_hook), sugira a timeline em 7 beats (vsl_beats) e liste 3 ângulos de criativos (ad_angles) aplicando os gatilhos emocionais.";
      setActiveTab("vsl");
    }
    handleSend(prompt);
  };

  // Export to imphq_docs as markdown
  const handleExportDoc = async () => {
    if (selectedProjectId === "none") {
      toast.error("Selecione um projeto para poder salvar o dossiê.");
      return;
    }

    try {
      const docId = crypto.randomUUID();
      const title = `Dossiê de Copy: ${dossier.nome || "Novo Produto"}`;
      const markdownContent = `# 🧠 Dossiê Estratégico & Copywriting: ${dossier.nome || "Sem Nome"}
**Nicho:** ${dossier.nicho}
**Arquétipo:** ${dossier.arquetipo}
**Garantia:** ${dossier.garantia}
**Preço:** ${dossier.preco}

---

## 🏛️ Branding & Posicionamento
*   **Tom de Voz:** ${dossier.tom_voz}
*   **Manifesto da Marca:** 
${dossier.manifesto}

---

## ⚙️ Mecanismo Único & One Belief
*   **One Belief:** ${dossier.one_belief}
*   **Método/Mecanismo:** ${dossier.mecanismo_nome}
*   **Claim de Funcionamento:** ${dossier.mecanismo_claim}
*   **Escada de Pontos Lógicos:**
${dossier.logic_points}

---

## 💸 Oferta Grand Slam
*   **Escada de Ancoragem:** ${dossier.ancoragem}
*   **Stack de Bônus:**
${dossier.bonus}

---

## 🎬 Roteiro VSL & Ângulos de Tráfego
*   **Gancho de Abertura (0-90s):** ${dossier.vsl_hook}
*   **Timeline VSL (7 Beats):**
${dossier.vsl_beats}
*   **Ângulos de Anúncio:**
${dossier.ad_angles}
`;

      const { error } = await supabase.from("imphq_docs").insert({
        id: docId,
        project_id: selectedProjectId,
        title,
        content: markdownContent,
        body: markdownContent,
        cat: "vsl-roteiro",
      });

      if (error) throw error;
      toast.success("Dossiê exportado com sucesso para a aba Documentos do projeto!");
    } catch (e: any) {
      toast.error("Erro ao salvar documento: " + e.message);
    }
  };

  // Save changes directly back into the project's data
  const handleSaveToProject = async () => {
    if (selectedProjectId === "none") {
      setNewProjectOpen(true);
      return;
    }

    setSavingProject(true);
    try {
      const proj = projects.find(p => p.id === selectedProjectId);
      const currentData = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
      const currentAvatar = proj.avatar || {};

      // Merge copilot dossier values into the project schema
      const updatedData = {
        ...currentData,
        produto: dossier.nome,
        precos: {
          ...currentData.precos,
          principal: dossier.preco,
          garantia: dossier.garantia
        },
        produtos_bonus: dossier.bonus,
        branding: {
          ...currentData.branding,
          tom_de_voz: dossier.tom_voz,
          arquetipo: dossier.arquetipo,
          manifesto: dossier.manifesto
        },
        copy_arsenal: {
          ...currentData.copy_arsenal,
          one_belief: dossier.one_belief,
          metodo_simplificado: [dossier.mecanismo_nome],
          oportunidade: [dossier.mecanismo_claim],
          logic_points: dossier.logic_points,
          ancoragem: dossier.ancoragem,
          vsl_hook: dossier.vsl_hook,
          vsl_beats: dossier.vsl_beats,
          ad_angles: dossier.ad_angles
        },
        briefing: {
          ...currentData.briefing,
          nicho: dossier.nicho
        }
      };

      const updatedAvatar = {
        ...currentAvatar,
        crenca_necessaria: dossier.one_belief
      };

      const { error } = await supabase
        .from("imphq_projects")
        .update({
          data: updatedData,
          avatar: updatedAvatar
        })
        .eq("id", selectedProjectId);

      if (error) throw error;
      
      // Update local state
      setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, data: updatedData, avatar: updatedAvatar } : p));
      toast.success("Dados salvos e sincronizados com o projeto com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao sincronizar com o projeto: " + e.message);
    } finally {
      setSavingProject(false);
    }
  };

  // Create a brand new project
  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      toast.error("Digite o nome do novo projeto.");
      return;
    }

    setSavingProject(true);
    try {
      const newId = crypto.randomUUID();
      const initialData = {
        produto: dossier.nome,
        precos: { principal: dossier.preco, garantia: dossier.garantia },
        produtos_bonus: dossier.bonus,
        branding: {
          tom_de_voz: dossier.tom_voz,
          arquetipo: dossier.arquetipo,
          manifesto: dossier.manifesto
        },
        copy_arsenal: {
          one_belief: dossier.one_belief,
          metodo_simplificado: [dossier.mecanismo_nome],
          oportunidade: [dossier.mecanismo_claim],
          logic_points: dossier.logic_points,
          ancoragem: dossier.ancoragem,
          vsl_hook: dossier.vsl_hook,
          vsl_beats: dossier.vsl_beats,
          ad_angles: dossier.ad_angles
        },
        briefing: { nicho: dossier.nicho }
      };

      const { error } = await supabase.from("imphq_projects").insert({
        id: newId,
        name: newProjectName,
        category: newProjectCategory,
        status: "em_construcao",
        icon: "🧠",
        color: "#d4a843",
        data: initialData,
        avatar: { crenca_necessaria: dossier.one_belief }
      });

      if (error) throw error;

      toast.success("Novo projeto criado com sucesso!");
      setNewProjectOpen(false);
      setNewProjectName("");
      await loadProjects();
      setSelectedProjectId(newId);
    } catch (e: any) {
      toast.error("Erro ao criar projeto: " + e.message);
    } finally {
      setSavingProject(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto text-slate-100">
      <ProdutoTabs />
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display italic text-3xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="h-8 w-8 text-gold drop-shadow-[0_0_10px_hsl(var(--gold)/0.4)]" /> 
            Copilot de Criação <span className="text-gold font-serif not-italic">de Produtos & Funis</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            Crie mecanismos de vendas, branding, ofertas grand slam e timeline de VSL para qualquer projeto.
          </p>
        </div>
        
        {/* Project Selector */}
        <div className="flex items-center gap-2 self-start md:self-center bg-card/30 p-1.5 rounded-lg border border-border/40 backdrop-blur-md">
          <FolderOpen className="h-4 w-4 text-gold ml-2" />
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[230px] h-9 border-none bg-transparent text-xs text-slate-200">
              <SelectValue placeholder="Selecione o Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">✨ Novo Produto (Sem Projeto)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.icon || "📁"} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Conversational Chat */}
        <div className="lg:col-span-5 flex flex-col h-[70vh] rounded-xl border border-border/40 bg-card/25 backdrop-blur-lg overflow-hidden shadow-2xl">
          
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border/40 bg-secondary/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold animate-pulse" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-widest font-mono">Conselho Criativo</span>
            </div>
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/20 font-mono">GPT-4o Mini</Badge>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-2 border-b border-border/40 bg-secondary/10 flex flex-wrap gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={() => triggerFastAction("naming")} className="text-[10px] h-7 border-gold/25 text-gold hover:bg-gold/10 gap-1">
              <PenTool className="h-3 w-3" /> Naming & Tom
            </Button>
            <Button variant="outline" size="sm" onClick={() => triggerFastAction("mecanismo")} className="text-[10px] h-7 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 gap-1">
              <Wrench className="h-3 w-3" /> Mecanismo
            </Button>
            <Button variant="outline" size="sm" onClick={() => triggerFastAction("oferta")} className="text-[10px] h-7 border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-1">
              <Award className="h-3 w-3" /> Oferta & Bônus
            </Button>
            <Button variant="outline" size="sm" onClick={() => triggerFastAction("vsl")} className="text-[10px] h-7 border-purple-500/20 text-purple-400 hover:bg-purple-500/10 gap-1">
              <Lightbulb className="h-3 w-3" /> Ganchos & VSL
            </Button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-16 px-4 space-y-3">
                <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">Pronto para estruturar o produto</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-5">
                  Digite seu ponto de partida (nicho, audiência, promessa) ou use as **Ações Rápidas** acima para começar a moldar o dossiê.
                </p>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-xs mr-2 mt-0.5 border border-border/40">
                    👑
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold text-slate-950 font-medium rounded-br-sm shadow-md"
                    : "bg-secondary/40 border border-border/30 rounded-bl-sm text-slate-200"
                }`}>
                  <div className="prose prose-xs prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-xs border border-border/40">
                  👑
                </div>
                <div className="bg-secondary/40 border border-border/30 rounded-xl rounded-bl-sm px-4 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-border/40 bg-card/45 shrink-0 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Pergunte ao copilot..."
              className="bg-secondary/50 border-none text-xs h-9 focus-visible:ring-1 focus-visible:ring-gold/45"
            />
            <Button onClick={() => handleSend()} size="icon" className="shrink-0 h-9 w-9 bg-gold text-slate-950 hover:bg-gold/80" disabled={sending || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Right Column - Structured Product Dossier Playground */}
        <div className="lg:col-span-7 flex flex-col h-[70vh] rounded-xl border border-border/40 bg-card/25 backdrop-blur-lg overflow-hidden shadow-2xl">
          
          {/* Dossier Header */}
          <div className="px-4 py-3 border-b border-border/40 bg-secondary/15 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-widest font-mono">Dossiê do Produto</span>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportDoc} className="text-[10px] h-7 border-border/60 hover:text-foreground">
                <FileDown className="h-3 w-3 mr-1" /> Exportar MD
              </Button>
              <Button size="sm" onClick={handleSaveToProject} disabled={savingProject} className="text-[10px] h-7 bg-gold text-slate-950 hover:bg-gold/80 font-medium">
                {savingProject ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar no Projeto
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-border/30 bg-secondary/5 shrink-0 px-2 py-1.5">
              <TabsList className="bg-transparent border-none p-0 h-auto gap-1">
                <TabsTrigger value="branding" className="text-[10px] font-semibold data-[state=active]:bg-secondary/40 data-[state=active]:text-gold">Branding & Naming</TabsTrigger>
                <TabsTrigger value="mecanismo" className="text-[10px] font-semibold data-[state=active]:bg-secondary/40 data-[state=active]:text-emerald-400">Mecanismo Único</TabsTrigger>
                <TabsTrigger value="oferta" className="text-[10px] font-semibold data-[state=active]:bg-secondary/40 data-[state=active]:text-blue-400">Oferta & Bônus</TabsTrigger>
                <TabsTrigger value="vsl" className="text-[10px] font-semibold data-[state=active]:bg-secondary/40 data-[state=active]:text-purple-400">VSL & Ganchos</TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Contents - Scrollable Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* BRANDING TAB */}
              <TabsContent value="branding" className="mt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="nome" className="text-[10px] text-muted-foreground uppercase font-mono">Nome do Produto</Label>
                    <Input id="nome" value={dossier.nome} onChange={(e) => handleFieldChange("nome", e.target.value)} placeholder="Ex: Método Alisamento Perfeito" className="bg-secondary/20 border-border/40 text-xs h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nicho" className="text-[10px] text-muted-foreground uppercase font-mono">Nicho / Categoria</Label>
                    <Input id="nicho" value={dossier.nicho} onChange={(e) => handleFieldChange("nicho", e.target.value)} placeholder="Ex: Beleza / Cabelos" className="bg-secondary/20 border-border/40 text-xs h-8" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="arquetipo" className="text-[10px] text-muted-foreground uppercase font-mono">Arquétipo da Marca</Label>
                  <Select value={dossier.arquetipo} onValueChange={(v) => handleFieldChange("arquetipo", v)}>
                    <SelectTrigger className="bg-secondary/20 border-border/40 text-xs h-8">
                      <SelectValue placeholder="Selecione o arquétipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="heroi">⚔️ O Herói</SelectItem>
                      <SelectItem value="mentor">🎓 O Sábio / Mentor</SelectItem>
                      <SelectItem value="fora_da_lei">🔥 O Fora da Lei / Rebelde</SelectItem>
                      <SelectItem value="explorador">🧭 O Explorador</SelectItem>
                      <SelectItem value="criador">🎨 O Criador</SelectItem>
                      <SelectItem value="mago">✨ O Mago</SelectItem>
                      <SelectItem value="rei">👑 O Governante / Rei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tom_voz" className="text-[10px] text-muted-foreground uppercase font-mono">Tom de Voz & Comunicação</Label>
                  <Textarea id="tom_voz" value={dossier.tom_voz} onChange={(e) => handleFieldChange("tom_voz", e.target.value)} placeholder="Ex: Direto, confessional, magnético, sem rodeios." className="bg-secondary/20 border-border/40 text-xs min-h-[60px]" rows={2} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="manifesto" className="text-[10px] text-muted-foreground uppercase font-mono">Manifesto da Marca</Label>
                  <Textarea id="manifesto" value={dossier.manifesto} onChange={(e) => handleFieldChange("manifesto", e.target.value)} placeholder="A mensagem forte da marca que une o público contra o vilão comum..." className="bg-secondary/20 border-border/40 text-xs min-h-[140px]" rows={5} />
                </div>
              </TabsContent>

              {/* MECANISMO UNICO TAB */}
              <TabsContent value="mecanismo" className="mt-0 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="mecanismo_nome" className="text-[10px] text-muted-foreground uppercase font-mono">Nome do Método / Mecanismo</Label>
                  <Input id="mecanismo_nome" value={dossier.mecanismo_nome} onChange={(e) => handleFieldChange("mecanismo_nome", e.target.value)} placeholder="Ex: Protocolo Liso Químico" className="bg-secondary/20 border-border/40 text-xs h-8" />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="one_belief" className="text-[10px] text-muted-foreground uppercase font-mono">One Belief (A Crença Nuclear)</Label>
                  <Textarea id="one_belief" value={dossier.one_belief} onChange={(e) => handleFieldChange("one_belief", e.target.value)} placeholder="A única crença que o lead precisa ter para comprar imediatamente..." className="bg-secondary/20 border-border/40 text-xs min-h-[60px]" rows={2} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="mecanismo_claim" className="text-[10px] text-muted-foreground uppercase font-mono">Claim Central de Funcionamento</Label>
                  <Textarea id="mecanismo_claim" value={dossier.mecanismo_claim} onChange={(e) => handleFieldChange("mecanismo_claim", e.target.value)} placeholder="Como o mecanismo age fisicamente ou biologicamente para curar a dor..." className="bg-secondary/20 border-border/40 text-xs min-h-[80px]" rows={3} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="logic_points" className="text-[10px] text-muted-foreground uppercase font-mono">Escada de Pontos Lógicos</Label>
                  <Textarea id="logic_points" value={dossier.logic_points} onChange={(e) => handleFieldChange("logic_points", e.target.value)} placeholder="Passo 1 -> Claim | Passo 2 -> Prova | Passo 3 -> Benefício..." className="bg-secondary/20 border-border/40 text-xs min-h-[120px]" rows={4} />
                </div>
              </TabsContent>

              {/* OFERTA & BONUS TAB */}
              <TabsContent value="oferta" className="mt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="preco" className="text-[10px] text-muted-foreground uppercase font-mono">Preço Sugerido</Label>
                    <Input id="preco" value={dossier.preco} onChange={(e) => handleFieldChange("preco", e.target.value)} placeholder="Ex: R$ 997,00" className="bg-secondary/20 border-border/40 text-xs h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="garantia" className="text-[10px] text-muted-foreground uppercase font-mono">Garantia</Label>
                    <Input id="garantia" value={dossier.garantia} onChange={(e) => handleFieldChange("garantia", e.target.value)} placeholder="Ex: 7 dias incondicional" className="bg-secondary/20 border-border/40 text-xs h-8" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ancoragem" className="text-[10px] text-muted-foreground uppercase font-mono">Escada de Ancoragem</Label>
                  <Textarea id="ancoragem" value={dossier.ancoragem} onChange={(e) => handleFieldChange("ancoragem", e.target.value)} placeholder="Como o preço é ancorado antes da revelação (ex: Custo de consultoria de R$5.000...)" className="bg-secondary/20 border-border/40 text-xs min-h-[80px]" rows={3} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bonus" className="text-[10px] text-muted-foreground uppercase font-mono">Stack de Bônus Agressivos</Label>
                  <Textarea id="bonus" value={dossier.bonus} onChange={(e) => handleFieldChange("bonus", e.target.value)} placeholder="Bônus 1: [Nome] (Elimina Objeção X)\nBônus 2: [Nome] (Acelera Velocidade Y)..." className="bg-secondary/20 border-border/40 text-xs min-h-[140px]" rows={5} />
                </div>
              </TabsContent>

              {/* VSL & CRIATIVOS TAB */}
              <TabsContent value="vsl" className="mt-0 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="vsl_hook" className="text-[10px] text-muted-foreground uppercase font-mono">Gancho de Entrada (Primeiro Minuto)</Label>
                  <Textarea id="vsl_hook" value={dossier.vsl_hook} onChange={(e) => handleFieldChange("vsl_hook", e.target.value)} placeholder="Ganchos de atenção instantânea..." className="bg-secondary/20 border-border/40 text-xs min-h-[60px]" rows={2} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="vsl_beats" className="text-[10px] text-muted-foreground uppercase font-mono">Timeline Beats (7 Blocos de Roteiro)</Label>
                  <Textarea id="vsl_beats" value={dossier.vsl_beats} onChange={(e) => handleFieldChange("vsl_beats", e.target.value)} placeholder="Cronologia estruturada do roteiro de VSL..." className="bg-secondary/20 border-border/40 text-xs min-h-[140px]" rows={5} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ad_angles" className="text-[10px] text-muted-foreground uppercase font-mono">Ângulos de Anúncios e Headlines</Label>
                  <Textarea id="ad_angles" value={dossier.ad_angles} onChange={(e) => handleFieldChange("ad_angles", e.target.value)} placeholder="Headline 1 (Raiva): [Texto]\nHeadline 2 (Medo): [Texto]..." className="bg-secondary/20 border-border/40 text-xs min-h-[100px]" rows={4} />
                </div>
              </TabsContent>

            </div>
          </Tabs>

        </div>

      </div>

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="bg-slate-900 border border-border/50 text-slate-100">
          <DialogHeader>
            <DialogTitle>Salvar em Novo Projeto</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Você está criando um projeto com base no dossiê estruturado atual. Digite as configurações iniciais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="new-name" className="text-[11px] uppercase tracking-wider font-mono">Nome do Projeto</Label>
              <Input id="new-name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Ex: Projeto Liso de Luxo" className="bg-slate-800 border-border/40 text-xs h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-category" className="text-[11px] uppercase tracking-wider font-mono">Vertical / Categoria</Label>
              <Select value={newProjectCategory} onValueChange={setNewProjectCategory}>
                <SelectTrigger className="bg-slate-800 border-border/40 text-xs h-9">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infoproduto">🚀 Lançamento / Infoproduto</SelectItem>
                  <SelectItem value="igaming">🎰 iGaming / Entretenimento</SelectItem>
                  <SelectItem value="ecommerce">🛒 E-commerce / Físicos</SelectItem>
                  <SelectItem value="servicos">💼 Prestação de Serviços</SelectItem>
                  <SelectItem value="outros">📁 Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)} className="text-xs">Cancelar</Button>
            <Button onClick={handleCreateNewProject} disabled={savingProject} className="bg-gold text-slate-950 hover:bg-gold/80 text-xs">
              {savingProject ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Criar e Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
