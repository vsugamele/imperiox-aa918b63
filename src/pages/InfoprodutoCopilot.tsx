import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ProdutoTabs } from "@/components/produto/ProdutoTabs";
import { 
  Brain, Send, Sparkles, FolderOpen, Save, FileDown, 
  Loader2, PlusCircle, CheckCircle2, Circle, Play, RefreshCw, Pencil, Check, ArrowRight, BookOpen
} from "lucide-react";
import { COPILOT_FRAMEWORKS } from "@/data/copilotFrameworks";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface InfoprodutoDossier {
  pesquisa: string;
  avatar: string;
  produto: string;
  oferta: string;
  salesPage: string;
  vsl: string;
  webinar: string;
  criativos: string;
  emails: string;
  nome: string;
  nicho: string;
  preco: string;
}

const emptyDossier: InfoprodutoDossier = {
  pesquisa: "",
  avatar: "",
  produto: "",
  oferta: "",
  salesPage: "",
  vsl: "",
  webinar: "",
  criativos: "",
  emails: "",
  nome: "",
  nicho: "",
  preco: "",
};

interface Phase {
  id: keyof Omit<InfoprodutoDossier, "nome" | "nicho" | "preco">;
  name: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  prompt: string;
  dbCat: string;
}

const PHASES: Phase[] = [
  {
    id: "pesquisa",
    name: "Pesquisa",
    icon: "📊",
    color: "from-amber-500 to-orange-600",
    title: "Pesquisa de Mercado",
    description: "Análise de nicho, validação de demanda, posicionamento estratégico e diferenciação inicial.",
    prompt: "Por favor, faça uma pesquisa de mercado profunda para o nicho de [Nicho/Sub-nicho]. Identifique os concorrentes mais comuns, a dor superficial, e sugira um posicionamento magnético para nos diferenciarmos.",
    dbCat: "pesquisa"
  },
  {
    id: "avatar",
    name: "Avatar",
    icon: "👤",
    color: "from-rose-500 to-pink-600",
    title: "Avatar / Persona",
    description: "Retrato detalhado das dores conscientes, desejos ocultos, ferida central e crenças limitantes do lead ideal.",
    prompt: "Com base no nicho e posicionamento, monte o perfil psicológico completo do nosso Avatar ideal. Divida nas 4 camadas da psique: C1 Sintomas Observáveis, C2 Dores Conscientes, C3 Reparação do Ego Ferido e C4 Ferida Central. Adicione também a crença necessária para a compra.",
    dbCat: "avatar"
  },
  {
    id: "produto",
    name: "Produto",
    icon: "🧠",
    color: "from-indigo-500 to-purple-600",
    title: "Estrutura do Produto",
    description: "Definição do nome, slogan, formato (curso + ebook + comunidade), promessa principal e grade de módulos.",
    prompt: "Crie a estrutura completa do nosso infoproduto. Sugira 3 nomes chamativos, o slogan e monte uma ementa prática dividida em módulos (curso + ebook + comunidade) onde cada módulo resolve diretamente uma dor mapeada do avatar.",
    dbCat: "produto"
  },
  {
    id: "oferta",
    name: "Oferta",
    icon: "💎",
    color: "from-emerald-500 to-teal-600",
    title: "Oferta Grand Slam",
    description: "Precificação estratégica, empilhamento de bônus que quebram objeções e garantia de risco zero.",
    prompt: "Gere os termos da Oferta Grand Slam aplicando os ensinamentos do Alex Hormozi. Sugira o preço ideal, a escada de ancoragem e empilhe bônus agressivos com seus respectivos propósitos. Defina a política de garantia incondicional.",
    dbCat: "oferta"
  },
  {
    id: "salesPage",
    name: "Sales Page",
    icon: "📄",
    color: "from-blue-500 to-cyan-600",
    title: "Página de Vendas",
    description: "Estrutura e copy da sales page de alta conversão dividida em blocos lógicos persuasivos.",
    prompt: "Gere a copy e a estrutura da nossa Página de Vendas (Sales Page) seguindo a estrutura de 14 blocos. Inclua a headline devastadora, o espelho da dor, a apresentação do mecanismo e a ancoragem da oferta com FAQ.",
    dbCat: "sales-page"
  },
  {
    id: "vsl",
    name: "Roteiro VSL",
    icon: "🎬",
    color: "from-red-500 to-orange-600",
    title: "Roteiro de VSL",
    description: "Script do vídeo de vendas estruturado em 7 blocos com ganchos de alta retenção.",
    prompt: "Crie o roteiro detalhado para nossa VSL (Video Sales Letter). Use a estrutura de 7 blocos, detalhando o gancho de abertura (primeiro minuto), a história de origem com a epifania e a transição lógica para a oferta e fechamento.",
    dbCat: "vsl-roteiro"
  },
  {
    id: "webinar",
    name: "Webinar",
    icon: "🎤",
    color: "from-violet-500 to-fuchsia-600",
    title: "Script de Webinar",
    description: "Script de apresentação ao vivo estruturada em gancho, 3 pilares de conteúdo e transição para o pitch.",
    prompt: "Estruture o script completo para nosso Webinar de lançamento. Divida-o em introdução magnética, 3 segredos práticos de conteúdo (com quebra de objeções implícita) e a transição inevitável para o pitch de vendas do produto.",
    dbCat: "webinar-roteiro"
  },
  {
    id: "criativos",
    name: "Criativos Ads",
    icon: "🎨",
    color: "from-sky-500 to-blue-600",
    title: "Criativos de Tráfego",
    description: "Ângulos de anúncios baseados em dores e desejos, headlines e sugestões visuais para tráfego pago.",
    prompt: "Gere 5 ângulos de criativos para anúncios (Medo, Raiva, Lógica, Status e Curiosidade). Para cada ângulo, escreva a headline pronta, o texto principal do anúncio e descreva o criativo visual sugerido (imagem ou vídeo).",
    dbCat: "criativos"
  },
  {
    id: "emails",
    name: "E-mails",
    icon: "📧",
    color: "from-teal-500 to-green-600",
    title: "Sequência de E-mails",
    description: "Fluxo de e-mails persuasivos para aquecimento, abertura de carrinho, urgência e escassez final.",
    prompt: "Desenhe a sequência de e-mails de lançamento (5 e-mails). E-mail 1: Aquecimento & Epifania, E-mail 2: Abertura de Carrinho, E-mail 3: Prova Social, E-mail 4: Urgência/Bônus Expirando, E-mail 5: Última Chamada/Escassez.",
    dbCat: "emails"
  }
];

export default function InfoprodutoCopilot() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  
  // Pipeline Orchestration State
  const [dossier, setDossier] = useState<InfoprodutoDossier>(emptyDossier);
  const [activePhaseId, setActivePhaseId] = useState<keyof Omit<InfoprodutoDossier, "nome" | "nicho" | "preco">>("pesquisa");
  const [completedPhases, setCompletedPhases] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

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
      setCompletedPhases([]);
      return;
    }

    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj) {
      const d = typeof proj.data === "string" ? (() => { try { return JSON.parse(proj.data); } catch { return {}; } })() : (proj.data || {});
      const av = proj.avatar || {};
      
      // Load existing data from projects and see if we have infoproduto structure in data.infoproduto
      const info = d.infoproduto || {};
      
      const loadedDossier: InfoprodutoDossier = {
        nome: info.nome || d.produto || proj.name || "",
        nicho: info.nicho || d.briefing?.nicho || d.category || "",
        preco: info.preco || d.precos?.principal || "",
        pesquisa: info.pesquisa || "",
        avatar: info.avatar || av.retrato || "",
        produto: info.produto || "",
        oferta: info.oferta || d.produtos_bonus || "",
        salesPage: info.salesPage || "",
        vsl: info.vsl || d.copy_arsenal?.vsl_hook || "",
        webinar: info.webinar || "",
        criativos: info.criativos || d.copy_arsenal?.ad_angles || "",
        emails: info.emails || "",
      };
      
      setDossier(loadedDossier);

      // Determine completed phases based on presence of content
      const completed: string[] = [];
      PHASES.forEach(p => {
        if (loadedDossier[p.id] && loadedDossier[p.id].trim().length > 100) {
          completed.push(p.id);
        }
      });
      setCompletedPhases(completed);
      
      setMessages([
        {
          role: "assistant",
          content: `Carreguei o projeto **${proj.icon || "🚀"} ${proj.name}** no Orquestrador de Infoprodutos. Já recuperei os dados salvos anteriormente.\n\nQual fase gostaria de iniciar ou revisar hoje? Você pode seguir o fluxo passo a passo ou focar em uma etapa específica.`
        }
      ]);
    }
  }, [selectedProjectId, projects]);

  const activePhase = PHASES.find(p => p.id === activePhaseId)!;

  // Toggle edit mode for the dossier content
  const startEditing = () => {
    setEditContent(dossier[activePhaseId]);
    setIsEditing(true);
  };

  const saveEditedContent = () => {
    setDossier(prev => ({
      ...prev,
      [activePhaseId]: editContent
    }));
    setIsEditing(false);
    
    // Mark as completed if it has content
    if (editContent.trim().length > 50 && !completedPhases.includes(activePhaseId)) {
      setCompletedPhases(prev => [...prev, activePhaseId]);
    }
    
    toast.success("Conteúdo atualizado manualmente!");
  };

  // Helper to construct system prompt
  const buildSystemPrompt = () => {
    let context = `Você é o Orquestrador Supremo de Infoprodutos da Imperio HQ — um estrategista de lançamentos e copywriter de resposta direta de elite.
Seu objetivo é ajudar o usuário a planejar, criar e estruturar um infoproduto completo passo a passo.

O processo de criação consiste em 9 fases:
${PHASES.map((p, idx) => `${idx + 1}. ${p.title}: ${p.description}`).join("\n")}

### REGRAS GERAIS DE COPYWRITING (APLIQUE OBRIGATORIAMENTE):
1. **Estrutura de VSL em 7 Blocos**:
${COPILOT_FRAMEWORKS.vsl.blocks.map(b => `- Bloco ${b.num}: ${b.title} (${b.description}) -> REGRA: ${b.rule}`).join("\n")}

2. **Equação de Valor Grand Slam**:
- Fórmula: ${COPILOT_FRAMEWORKS.valueEquation.formula}
- Regras: ${COPILOT_FRAMEWORKS.valueEquation.rules.join(" | ")}

3. **Estrutura de Sales Page (PDS) em 14 Blocos**:
- Blocos: ${COPILOT_FRAMEWORKS.salesPage.blocks.join(" -> ")}

4. **Camadas do Avatar**:
- C1: Sintomas Observáveis, C2: Dores Conscientes, C3: Reparação do Ego Ferido (desejos ocultos), C4: Ferida Central (trauma).

5. **Ângulos de Anúncios**:
${COPILOT_FRAMEWORKS.adAngles.map(a => `- ${a.name}: ${a.focus}`).join("\n")}

Você deve ser magnético, contundente, pragmático e detalhado nas suas respostas. Responda em Português do Brasil.
`;

    if (selectedProjectId !== "none") {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        context += `\n\n### CONTEXTO DO PROJETO SELECIONADO:
- Nome do Projeto: ${proj.name}
- Produto Atual: ${dossier.nome || "Não definido"}
- Nicho/Categoria: ${dossier.nicho || "Não definido"}
- Preço Sugerido: ${dossier.preco || "Não definido"}
`;
      }
    }

    // Add state of other phases to give AI contextual awareness
    context += `\n\n### ESTADO ATUAL DO DOSSIÊ DO INFOPRODUTO:`;
    PHASES.forEach(p => {
      const hasContent = dossier[p.id] && dossier[p.id].trim().length > 0;
      context += `\n- Fase [${p.id}] (${hasContent ? "PREENCHIDA" : "VAZIA"}): ${hasContent ? dossier[p.id].substring(0, 300) + "..." : "Sem conteúdo ainda."}`;
    });

    context += `\n\n### INSTRUÇÃO CRÍTICA DE RETORNO (JSON SYNC):
Quando o usuário solicitar a geração ou refinamento da fase ativa ("${activePhase.title}"), retorne sua análise estratégica, dicas e o texto persuasivo no chat em formato markdown normal.
No final absoluto da sua mensagem, você DEVE retornar a tag \`\`\`json-infoproduto contendo as informações atualizadas desta fase em formato JSON, com as chaves:
- "phase": string (deve ser exatamente "${activePhaseId}")
- "content": string (o texto completo estruturado em markdown para esta fase)
- "metadata": objeto com "nome", "nicho", "preco" (atualize se houver novidades sobre o produto)

Exemplo:
\`\`\`json-infoproduto
{
  "phase": "${activePhaseId}",
  "content": "# ${activePhase.title}\\n\\nConteúdo gerado completo em markdown...",
  "metadata": {
    "nome": "Nome do Produto",
    "nicho": "Nicho do Produto",
    "preco": "R$ 197"
  }
}
\`\`\`
Não invente outras chaves no JSON. Garanta que a string de content contenha quebras de linha escapadas (\\n) para ser um JSON válido.`;

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
      
      // Parse potential json-infoproduto block to update dossier state
      parseOrchestratorJson(reply);

      // Clean the chat UI from the raw json block
      const cleanedReply = reply.replace(/```json-infoproduto[\s\S]*?```/g, "").trim();

      setMessages((prev) => [...prev, { role: "assistant", content: cleanedReply }]);
    } catch (e: any) {
      toast.error("Erro na comunicação com a IA: " + (e.message || "tente novamente"));
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Erro ao obter resposta. Verifique a conexão com a Edge Function." }]);
    } finally {
      setSending(false);
    }
  };

  // Parse json-infoproduto tag and update state
  const parseOrchestratorJson = (text: string) => {
    try {
      const match = text.match(/```json-infoproduto([\s\S]*?)```/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1].trim());
        const phase = parsed.phase as keyof Omit<InfoprodutoDossier, "nome" | "nicho" | "preco">;
        const content = parsed.content;
        const metadata = parsed.metadata || {};

        setDossier((prev) => {
          const updated = {
            ...prev,
            [phase]: content,
            nome: metadata.nome || prev.nome,
            nicho: metadata.nicho || prev.nicho,
            preco: metadata.preco || prev.preco,
          };
          return updated;
        });

        // Mark phase as completed
        setCompletedPhases(prev => {
          if (!prev.includes(phase)) {
            return [...prev, phase];
          }
          return prev;
        });

        toast.success(`Fase ${phase.toUpperCase()} atualizada pela IA!`);
      }
    } catch (e) {
      console.error("Failed to parse sync JSON from AI", e);
    }
  };

  // Fast action triggers
  const triggerFastAction = (promptText: string) => {
    // Injeta os dados de nicho/produto se preenchidos
    let finalPrompt = promptText;
    if (dossier.nicho) {
      finalPrompt = finalPrompt.replace("[Nicho/Sub-nicho]", dossier.nicho);
    }
    handleSend(finalPrompt);
  };

  // Export the entire dossier to a single unified Markdown file
  const handleExportAll = () => {
    const title = dossier.nome || "Meu Infoproduto";
    const markdownContent = `# 🚀 Dossiê Geral do Infoproduto: ${title}
**Nicho:** ${dossier.nicho || "Não definido"}
**Preço Sugerido:** ${dossier.preco || "Não definido"}

============================================================

${PHASES.map(p => {
  return `## ${p.icon} Fase: ${p.title}
${dossier[p.id] || "_Fase não preenchida ainda._"}

============================================================
`;
}).join("\n")}`;

    const element = document.createElement("a");
    const file = new Blob([markdownContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${title.toLowerCase().replace(/\s+/g, "-")}-dossie.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Dossiê exportado com sucesso!");
  };

  // Save changes directly back into the project's data and create/update documents in imphq_docs
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

      // Merge values into the project schema
      const updatedData = {
        ...currentData,
        produto: dossier.nome,
        precos: {
          ...currentData.precos,
          principal: dossier.preco,
        },
        branding: {
          ...currentData.branding,
          nicho: dossier.nicho
        },
        briefing: {
          ...currentData.briefing,
          nicho: dossier.nicho
        },
        // Save the raw infoproduto copy structure in the JSON for recovery
        infoproduto: {
          nome: dossier.nome,
          nicho: dossier.nicho,
          preco: dossier.preco,
          pesquisa: dossier.pesquisa,
          avatar: dossier.avatar,
          produto: dossier.produto,
          oferta: dossier.oferta,
          salesPage: dossier.salesPage,
          vsl: dossier.vsl,
          webinar: dossier.webinar,
          criativos: dossier.criativos,
          emails: dossier.emails,
        }
      };

      const updatedAvatar = {
        ...currentAvatar,
        retrato: dossier.avatar
      };

      // Save back to project table
      const { error: projError } = await supabase
        .from("imphq_projects")
        .update({
          data: updatedData,
          avatar: updatedAvatar
        })
        .eq("id", selectedProjectId);

      if (projError) throw projError;

      // Now insert/update each phase as a separate document in imphq_docs
      const docsToInsert = PHASES.filter(p => dossier[p.id] && dossier[p.id].trim().length > 0).map(p => {
        return {
          project_id: selectedProjectId,
          title: `[Orquestrador] ${p.title}`,
          content: dossier[p.id],
          body: dossier[p.id],
          cat: p.dbCat,
          id: crypto.randomUUID(),
        };
      });

      if (docsToInsert.length > 0) {
        // Clean existing orquestrador docs to avoid duplication
        await supabase
          .from("imphq_docs")
          .delete()
          .eq("project_id", selectedProjectId)
          .like("title", "[Orquestrador]%");

        // Insert new documents
        const { error: docsError } = await supabase
          .from("imphq_docs")
          .insert(docsToInsert as any);

        if (docsError) throw docsError;
      }
      
      // Update local state
      setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, data: updatedData, avatar: updatedAvatar } : p));
      toast.success("Dossiê e documentos salvos e sincronizados com o projeto com sucesso!");
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
        produto: dossier.nome || newProjectName,
        precos: { principal: dossier.preco },
        briefing: { nicho: dossier.nicho },
        infoproduto: {
          nome: dossier.nome || newProjectName,
          nicho: dossier.nicho,
          preco: dossier.preco,
          pesquisa: dossier.pesquisa,
          avatar: dossier.avatar,
          produto: dossier.produto,
          oferta: dossier.oferta,
          salesPage: dossier.salesPage,
          vsl: dossier.vsl,
          webinar: dossier.webinar,
          criativos: dossier.criativos,
          emails: dossier.emails,
        }
      };

      const { error } = await supabase.from("imphq_projects").insert({
        id: newId,
        name: newProjectName,
        category: newProjectCategory,
        status: "em_construcao",
        icon: "🚀",
        color: "#d4a843",
        data: initialData,
        avatar: { retrato: dossier.avatar }
      });

      if (error) throw error;

      // Insert any generated phases to imphq_docs
      const docsToInsert = PHASES.filter(p => dossier[p.id] && dossier[p.id].trim().length > 0).map(p => {
        return {
          id: crypto.randomUUID(),
          project_id: newId,
          title: `[Orquestrador] ${p.title}`,
          content: dossier[p.id],
          body: dossier[p.id],
          cat: p.dbCat,
        };
      });

      if (docsToInsert.length > 0) {
        await supabase.from("imphq_docs").insert(docsToInsert as any);
      }

      toast.success("Novo projeto criado e sincronizado!");
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
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto text-slate-100 p-4 md:p-6">
      <ProdutoTabs />
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display italic text-3xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="h-8 w-8 text-gold drop-shadow-[0_0_10px_hsl(var(--gold)/0.4)]" /> 
            Orquestrador IA <span className="text-gold font-serif not-italic">de Infoprodutos</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            Criação guiada de ponta a ponta: Pesquisa, Avatar, Estrutura do Produto, Oferta, Sales Page, VSL, Webinar, Anúncios e E-mails.
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

      {/* Metadata Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card/10 p-4 rounded-xl border border-border/20 backdrop-blur-sm">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-mono">Nome do Produto</Label>
          <Input 
            value={dossier.nome} 
            onChange={(e) => setDossier(prev => ({ ...prev, nome: e.target.value }))} 
            placeholder="Ex: Fábrica de Conteúdo com IA" 
            className="bg-secondary/20 border-border/40 text-xs h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-mono">Nicho / Sub-nicho</Label>
          <Input 
            value={dossier.nicho} 
            onChange={(e) => setDossier(prev => ({ ...prev, nicho: e.target.value }))} 
            placeholder="Ex: IA Prática para Criadores de Conteúdo" 
            className="bg-secondary/20 border-border/40 text-xs h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-mono">Preço Sugerido</Label>
          <Input 
            value={dossier.preco} 
            onChange={(e) => setDossier(prev => ({ ...prev, preco: e.target.value }))} 
            placeholder="Ex: R$ 197,00" 
            className="bg-secondary/20 border-border/40 text-xs h-8"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Conversational Chat & Pipeline Steps */}
        <div className="lg:col-span-6 flex flex-col h-[75vh] rounded-xl border border-border/40 bg-card/25 backdrop-blur-lg overflow-hidden shadow-2xl">
          
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border/40 bg-secondary/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold animate-pulse" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-widest font-mono">Orquestrador Inteligente</span>
            </div>
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/20 font-mono">GPT-4o Mini</Badge>
          </div>

          {/* Stepper Header (Timeline Scroll) */}
          <div className="border-b border-border/30 bg-secondary/5 px-2 py-2 overflow-x-auto whitespace-nowrap flex gap-1 scrollbar-none shrink-0">
            {PHASES.map((p, idx) => {
              const isActive = activePhaseId === p.id;
              const isCompleted = completedPhases.includes(p.id);
              
              return (
                <button
                  key={p.id}
                  onClick={() => { setActivePhaseId(p.id); setIsEditing(false); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition duration-200 border ${
                    isActive 
                      ? "bg-gold/10 text-gold border-gold/40 shadow-[0_0_8px_hsl(var(--gold)/0.15)]" 
                      : isCompleted
                        ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                        : "bg-transparent text-slate-400 border-transparent hover:bg-secondary/20"
                  }`}
                >
                  <span className="text-sm">{p.icon}</span>
                  <span className="font-medium">{idx + 1}. {p.name}</span>
                  {isCompleted && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Quick Action Banner */}
          <div className="px-4 py-2 bg-secondary/10 border-b border-border/40 flex items-center justify-between gap-4 shrink-0 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-base">{activePhase.icon}</span>
              <div>
                <span className="font-semibold text-slate-200 block">Fase {PHASES.findIndex(p => p.id === activePhaseId) + 1}: {activePhase.title}</span>
                <span className="text-[10px] text-slate-400">{activePhase.description.substring(0, 75)}...</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => triggerFastAction(activePhase.prompt)}
              className="text-[10px] h-7 border-gold/30 text-gold hover:bg-gold/15 shrink-0 gap-1 bg-gold/5"
            >
              <Play className="h-2.5 w-2.5 fill-gold" /> Gerar Conteúdo
            </Button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-16 px-4 space-y-3">
                <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">Pronto para iniciar o infoproduto</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-5">
                  Preencha os dados do cabeçalho acima e clique em **"Gerar Conteúdo"** na Fase 1 (Pesquisa) para iniciarmos a estruturação.
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
              placeholder={`Converse com o orquestrador sobre a fase ${activePhase.name.toLowerCase()}...`}
              className="bg-secondary/50 border-none text-xs h-9 focus-visible:ring-1 focus-visible:ring-gold/45"
            />
            <Button onClick={() => handleSend()} size="icon" className="shrink-0 h-9 w-9 bg-gold text-slate-950 hover:bg-gold/80" disabled={sending || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Right Column - Dossiê Viewer & Editor */}
        <div className="lg:col-span-6 flex flex-col h-[75vh] rounded-xl border border-border/40 bg-card/25 backdrop-blur-lg overflow-hidden shadow-2xl">
          
          {/* Dossier Header */}
          <div className="px-4 py-3 border-b border-border/40 bg-secondary/15 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gold" /> Dossiê: {activePhase.title}
            </span>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-[10px] h-7 hover:bg-destructive/10 hover:text-destructive text-slate-400">
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEditedContent} className="text-[10px] h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1">
                    <Check className="h-3 w-3" /> Salvar Edição
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={startEditing} disabled={!dossier[activePhaseId]} className="text-[10px] h-7 border-border/60 hover:text-foreground">
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportAll} className="text-[10px] h-7 border-border/60 hover:text-foreground">
                    <FileDown className="h-3 w-3 mr-1" /> Exportar MD
                  </Button>
                  <Button size="sm" onClick={handleSaveToProject} disabled={savingProject} className="text-[10px] h-7 bg-gold text-slate-950 hover:bg-gold/80 font-medium">
                    {savingProject ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Sincronizar Projeto
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Dossiê Content Container */}
          <div className="flex-1 overflow-y-auto p-4 bg-secondary/5">
            {isEditing ? (
              <Textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)} 
                className="w-full h-full bg-slate-900/60 border border-border/40 text-xs font-mono leading-relaxed p-4 rounded-lg focus-visible:ring-1 focus-visible:ring-gold/45 min-h-[50vh]"
              />
            ) : (
              <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed">
                {dossier[activePhaseId] ? (
                  <ReactMarkdown>{dossier[activePhaseId]}</ReactMarkdown>
                ) : (
                  <div className="text-center py-24 text-muted-foreground flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full border border-dashed border-border/60 flex items-center justify-center text-lg">
                      {activePhase.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-300">Esta fase está vazia</p>
                      <p className="text-[10px] mt-1">Gere o conteúdo conversando com a IA no painel ao lado para sincronizar.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phase progress checklist footer */}
          <div className="px-4 py-3 bg-secondary/15 border-t border-border/40 flex items-center justify-between shrink-0 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">Progresso Geral:</span>
              <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-gold to-yellow-500 transition-all duration-300" 
                  style={{ width: `${(completedPhases.length / PHASES.length) * 100}%` }}
                />
              </div>
              <span className="text-gold font-bold">{completedPhases.length}/{PHASES.length}</span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[9px] h-6 px-2 hover:bg-secondary/40 text-slate-300"
                disabled={PHASES.findIndex(p => p.id === activePhaseId) === 0}
                onClick={() => {
                  const idx = PHASES.findIndex(p => p.id === activePhaseId);
                  setActivePhaseId(PHASES[idx - 1].id);
                  setIsEditing(false);
                }}
              >
                Voltar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[9px] h-6 px-2 hover:bg-secondary/40 text-gold hover:text-gold"
                disabled={PHASES.findIndex(p => p.id === activePhaseId) === PHASES.length - 1}
                onClick={() => {
                  const idx = PHASES.findIndex(p => p.id === activePhaseId);
                  setActivePhaseId(PHASES[idx + 1].id);
                  setIsEditing(false);
                }}
              >
                Próxima Fase <ArrowRight className="h-2.5 w-2.5 ml-1" />
              </Button>
            </div>
          </div>
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
              <Input id="new-name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Ex: Projeto IA Prática" className="bg-slate-800 border-border/40 text-xs h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-category" className="text-[11px] uppercase tracking-wider font-mono">Vertical / Categoria</Label>
              <Select value={newProjectCategory} onValueChange={setNewProjectCategory}>
                <SelectTrigger className="bg-slate-800 border-border/40 text-xs h-9">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infoproduto">🚀 Lançamento / Infoproduto</SelectItem>
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
