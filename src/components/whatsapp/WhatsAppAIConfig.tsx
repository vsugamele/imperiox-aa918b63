import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Save, Loader2, Brain, Clock, Shield, Zap, Sparkles, Plus, Trash2, RefreshCw, MessageSquare, Info, Sliders, Server, GraduationCap, CheckCircle, Copy, Mic, Upload, FileIcon, Eye, Download, FileText, HelpCircle, Target, Wand2, Package } from "lucide-react";
import AIWizardDialog from "./AIWizardDialog";
import SectorPackDialog from "./SectorPackDialog";
import { RefineAIDialog } from "./RefineAIDialog";
import AILearnedRulesPanel from "./AILearnedRulesPanel";
import { DocViewerDialog } from "@/components/projeto/DocViewerDialog";
import { MENTES_DATA } from "@/data/mentesData";

const FILE_MARKER = /^\[\[file:(.+?)\|(.+?)\]\]$/;
function parseDocContent(content: string | null | undefined): { kind: "file" | "text"; url?: string; mime?: string } {
  if (!content) return { kind: "text" };
  const m = content.trim().match(FILE_MARKER);
  if (m) return { kind: "file", url: m[1], mime: m[2] };
  return { kind: "text" };
}

interface FaqItem { pergunta: string; resposta: string; }

interface AIConfig {
  id?: string;
  project_id: string;
  provider_id?: string | null;
  enabled: boolean;
  personality: string;
  tone: string;
  max_tokens: number;
  escalation_keywords: string[];
  welcome_message: string;
  context_sources: string[];
  response_delay_seconds: number;
  business_hours_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
  expert_persona?: string;
  custom_instructions?: string;
  banned_phrases?: string[];
  auto_audit_enabled?: boolean;
  last_audit_at?: string | null;
  audit_findings?: any[];
  auto_tune_enabled?: boolean;
  auto_tune_apply?: boolean;
  last_tune_at?: string | null;
  tune_history?: any[];
  auto_escalation_enabled?: boolean;
  auto_drift_enabled?: boolean;
  auto_scoring_enabled?: boolean;
  last_drift_at?: string | null;
  drift_score?: number | null;
  product_focus?: string;
  faq?: FaqItem[];
  ignored_phones?: string[];
  voice_reply_enabled?: boolean;
  voice_provider?: string;
  voice_name?: string;
  voice_stability?: number;
  voice_clarity?: number;
  closer_mode_enabled?: boolean;
  payment_link?: string | null;
}

const PERSONALITIES = [
  { id: "assistente", label: "Assistente Geral", desc: "Cordial, acolhedor e informativo." },
  { id: "vendedor", label: "Closer de Vendas", desc: "Focado em conversão, conduzir para oferta e quebrar objeções." },
  { id: "suporte", label: "Suporte Técnico", desc: "Focado em resolução ágil de dúvidas e problemas." },
  { id: "consultor", label: "Consultor Expert", desc: "Autoridade técnica, oferece conselhos e recomendações." },
];

const TONES = [
  { id: "profissional", label: "Profissional" },
  { id: "casual", label: "Casual" },
  { id: "amigavel", label: "Amigável" },
  { id: "formal", label: "Formal" },
  { id: "urgente", label: "Urgente" },
];

const CONTEXT_OPTIONS = [
  { id: "briefing", label: "Briefing do Projeto", desc: "Contexto geral e metas do projeto" },
  { id: "avatar", label: "Avatar / Persona", desc: "Público-alvo, dores e desejos" },
  { id: "produtos", label: "Produtos & Preços", desc: "Valores, links e detalhes técnicos" },
  { id: "faq", label: "Perguntas Frequentes (FAQ)", desc: "Respostas literais cadastradas" },
  { id: "branding", label: "Tom de Marca", desc: "Diretrizes de comunicação" },
  { id: "copy_arsenal", label: "Arsenal de Copy", desc: "Gatilhos mentais e criativos" },
  { id: "expert", label: "Expert do Projeto", desc: "História e autoridade do especialista" },
];

interface Props {
  projectId: string;
  providerId?: string;
}

export default function WhatsAppAIConfig({ projectId, providerId }: Props) {
  const [config, setConfig] = useState<AIConfig>({
    project_id: projectId,
    enabled: false,
    personality: "assistente",
    tone: "profissional",
    max_tokens: 300,
    escalation_keywords: ["humano", "atendente", "pessoa", "falar com alguém"],
    welcome_message: "",
    context_sources: ["briefing", "avatar", "produtos", "faq"],
    response_delay_seconds: 3,
    business_hours_only: false,
    business_hours_start: "08:00",
    business_hours_end: "20:00",
    voice_reply_enabled: false,
    voice_provider: "openai",
    voice_name: "alloy",
    voice_stability: 75,
    voice_clarity: 85,
    closer_mode_enabled: true,
    payment_link: "",
  });
  const [saving, setSaving] = useState(false);
  const [customSkills, setCustomSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [refUploaded, setRefUploaded] = useState(false);
  const refAudioInputRef = useRef<HTMLInputElement>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testImageUrl, setTestImageUrl] = useState("");
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [ignoredPhonesText, setIgnoredPhonesText] = useState("");
  const [projectProducts, setProjectProducts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [testPhone, setTestPhone] = useState<string>("");
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [trainingIds, setTrainingIds] = useState<string[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [unanswered, setUnanswered] = useState<any[]>([]);
  const [unansweredLoading, setUnansweredLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [approvingIds, setApprovingIds] = useState<string[]>([]);
  const [exampleQuestion, setExampleQuestion] = useState("");
  const [exampleAnswer, setExampleAnswer] = useState("");
  const [savingExample, setSavingExample] = useState(false);
  const [metrics, setMetrics] = useState({
    avgLatency: 0,
    totalCost: 0,
    successRate: 100,
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0
  });

  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([]);
  const [elevenLabsLoading, setElevenLabsLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);

  const fetchElevenLabsVoices = async () => {
    setElevenLabsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { action: "list_elevenlabs_voices" }
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.voices)) {
        setElevenLabsVoices(data.voices);
      } else if (data?.error) {
        console.warn("ElevenLabs loading warning:", data.error);
        toast.warning(data.error);
      }
    } catch (err: any) {
      console.error("Error fetching ElevenLabs voices:", err.message);
    } finally {
      setElevenLabsLoading(false);
    }
  };

  useEffect(() => {
    if (config.voice_reply_enabled && config.voice_provider === "elevenlabs") {
      fetchElevenLabsVoices();
    }
  }, [config.voice_reply_enabled, config.voice_provider]);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("imphq_wa_ai_logs")
        .select("id, latency_seconds, cost_usd, success, prompt_tokens, completion_tokens, total_tokens, created_at, model, error_message")
        .eq("project_id", projectId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items = data || [];
      setLogs(items.slice(0, 10)); // keep last 10 for display

      const totalCalls = items.length;
      const successCalls = items.filter(l => l.success).length;
      const failedCalls = totalCalls - successCalls;
      const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 100;
      const avgLatency = successCalls > 0 ? items.filter(l => l.success).reduce((acc, l) => acc + Number(l.latency_seconds || 0), 0) / successCalls : 0;
      const totalCost = items.reduce((acc, l) => acc + Number(l.cost_usd || 0), 0);

      setMetrics({
        avgLatency,
        totalCost,
        successRate,
        totalCalls,
        successCalls,
        failedCalls
      });
    } catch (err: any) {
      console.error("Error loading AI metrics:", err.message);
    } finally {
      setMetricsLoading(false);
    }
  };

  const isProductSelected = (productName: string) => {
    if (!config.product_focus) return false;
    return config.product_focus.toLowerCase().includes(productName.toLowerCase());
  };

  const handleToggleProduct = (product: any) => {
    if (isProductSelected(product.nome)) {
      const currentSelected = projectProducts.filter(p => p.nome !== product.nome && isProductSelected(p.nome));
      const newFocus = currentSelected.map(p => `Produto: ${p.nome}${p.preco ? ` · Preço: ${p.preco}` : ""}${p.link ? ` · Link: ${p.link}` : ""}`).join(" | ");
      setConfig(prev => ({ ...prev, product_focus: newFocus }));
    } else {
      const currentSelected = [...projectProducts.filter(p => isProductSelected(p.nome)), product];
      const newFocus = currentSelected.map(p => `Produto: ${p.nome}${p.preco ? ` · Preço: ${p.preco}` : ""}${p.link ? ` · Link: ${p.link}` : ""}`).join(" | ");
      setConfig(prev => ({ ...prev, product_focus: newFocus }));
    }
  };

  const handleSimulate = async () => {
    if (!testMessage.trim() && !testImageUrl.trim()) {
      toast.error("Digite uma mensagem ou insira uma URL de imagem para simular");
      return;
    }
    setSimulating(true);
    setSimulationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: {
          action: "simulate_ai_reply",
          project_id: projectId,
          provider_id: providerId || null,
          message: testMessage,
          history: [],
          phone: testPhone || null,
          media_url: testImageUrl || null,
          media_type: testImageUrl ? "image" : null,
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSimulationResult(data);
        toast.success("Simulação concluída com sucesso!");
        loadMetrics();
      } else {
        toast.error(data?.error || "Falha na simulação");
      }
    } catch (err: any) {
      toast.error("Erro ao simular: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Resposta copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchDocs = async () => {
    setDocsLoading(true);
    try {
      const { data, error } = await supabase
        .from("imphq_docs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      console.error("Erro ao buscar documentos:", err);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchUnanswered = async () => {
    setUnansweredLoading(true);
    try {
      const { data, error } = await supabase
        .from("imphq_wa_knowledge")
        .select("id, project_id, pergunta, resposta, source, score_uso, aprovada, answered, conversation_id, lead_id, created_at, updated_at, last_applied_at")
        .eq("project_id", projectId)
        .eq("aprovada", false)
        .eq("source", "lead_unanswered")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUnanswered(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar dúvidas não respondidas:", err.message);
    } finally {
      setUnansweredLoading(false);
    }
  };

  const handleApproveUnanswered = async (id: string, question: string) => {
    const answer = answers[id]?.trim();
    if (!answer) {
      toast.error("Por favor, digite uma resposta antes de aprovar.");
      return;
    }

    setApprovingIds(prev => [...prev, id]);
    try {
      // 1. Generate embedding using Lovable AI / OpenRouter via wa-doc-embedder Function
      const { data: embedData, error: embedErr } = await supabase.functions.invoke("wa-doc-embedder", {
        body: {
          action: "get_embedding",
          text: question,
        }
      });

      if (embedErr) throw embedErr;
      if (!embedData?.success || !embedData?.embedding) {
        throw new Error("Não foi possível gerar o embedding da pergunta.");
      }

      // 2. Update row in imphq_wa_knowledge
      const { error: updateErr } = await supabase
        .from("imphq_wa_knowledge")
        .update({
          resposta: answer,
          aprovada: true,
          embedding: embedData.embedding,
          source: "approved_fallback",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (updateErr) throw updateErr;

      toast.success("Dúvida aprovada, vetorizada e adicionada ao cérebro!");
      
      // Remove from pending list
      setUnanswered(prev => prev.filter(q => q.id !== id));
      // Remove answer from state
      setAnswers(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: any) {
      console.error("Erro ao aprovar dúvida pendente:", err);
      toast.error(`Erro ao aprovar: ${err.message}`);
    } finally {
      setApprovingIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleSaveExample = async () => {
    const q = exampleQuestion.trim();
    const a = exampleAnswer.trim();
    if (!q || !a) {
      toast.error("Preencha a pergunta e a resposta antes de salvar.");
      return;
    }
    setSavingExample(true);
    try {
      const { data: embedData, error: embedErr } = await supabase.functions.invoke("wa-doc-embedder", {
        body: { action: "get_embedding", text: q },
      });
      if (embedErr) throw embedErr;
      if (!embedData?.success || !embedData?.embedding) {
        throw new Error("Não foi possível gerar o embedding.");
      }
      const { error: insErr } = await supabase.from("imphq_wa_knowledge").insert({
        project_id: projectId,
        pergunta: q,
        resposta: a,
        embedding: embedData.embedding,
        source: "manual_example",
        aprovada: true,
      });
      if (insErr) throw insErr;
      toast.success("Exemplo salvo! A IA já aprenderá com ele.");
      setExampleQuestion("");
      setExampleAnswer("");
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingExample(false);
    }
  };

  const handleDeleteUnanswered = async (id: string) => {
    try {
      const { error } = await supabase
        .from("imphq_wa_knowledge")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Dúvida excluída com sucesso.");
      setUnanswered(prev => prev.filter(q => q.id !== id));
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  const triggerEmbedder = async (doc: any, active: boolean) => {
    setTrainingIds(prev => [...prev, doc.id]);
    try {
      const { data, error } = await supabase.functions.invoke("wa-doc-embedder", {
        body: {
          doc_id: doc.id,
          project_id: projectId,
          active
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(active 
        ? `Treinamento concluído! Documento vetorizado em ${data.chunks || 0} blocos.`
        : "Conhecimento removido da IA com sucesso!"
      );
      fetchDocs();
    } catch (err: any) {
      console.error("[triggerEmbedder] Error:", err);
      toast.error(`Falha no processamento: ${err.message || err}`);
    } finally {
      setTrainingIds(prev => prev.filter(id => id !== doc.id));
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setFileUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const title = file.name.replace(/\.[^.]+$/, "");
      const isText = ["txt", "md", "markdown"].includes(ext) || file.type.startsWith("text/");
      let content = "";
      
      try {
        if (isText) {
          content = await file.text();
        } else {
          // upload binary to storage
          const path = `docs/${projectId}/${crypto.randomUUID()}.${ext || "bin"}`;
          const { error: upErr } = await supabase.storage
            .from("project-media")
            .upload(path, file, { upsert: false, contentType: file.type || undefined });
          
          if (upErr) {
            toast.error(`Falha ao subir ${file.name}: ${upErr.message}`);
            continue;
          }
          
          const { data: urlData } = supabase.storage.from("project-media").getPublicUrl(path);
          content = `[[file:${urlData.publicUrl}|${file.type || "application/octet-stream"}]]`;
        }
        
        const newId = crypto.randomUUID();
        const { data, error } = await supabase
          .from("imphq_docs")
          .insert({
            id: newId,
            project_id: projectId,
            title,
            content,
            tags: ["ia_treinada"]
          } as any)
          .select()
          .single();
          
        if (error) throw error;
        
        if (data) {
          setDocs(prev => [data, ...prev]);
          ok++;
          triggerEmbedder(data, true);
        }
      } catch (err: any) {
        toast.error(`Erro ao salvar ${file.name}: ${err.message}`);
      }
    }
    setFileUploading(false);
    if (importFileRef.current) importFileRef.current.value = "";
    if (ok > 0) toast.success(`${ok} documento(s) importado(s) e enviado(s) para treinamento!`);
  };

  const toggleAiDoc = async (doc: any) => {
    const isTrained = doc.tags?.includes("ia_treinada") || false;
    const newTags = isTrained
      ? (doc.tags || []).filter((t: string) => t !== "ia_treinada")
      : [...(doc.tags || []), "ia_treinada"];

    // Optimistic UI update
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, tags: newTags } : d));

    try {
      const { error: updateErr } = await supabase
        .from("imphq_docs")
        .update({ tags: newTags })
        .eq("id", doc.id);

      if (updateErr) throw updateErr;

      await triggerEmbedder(doc, !isTrained);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
      // Rollback
      setDocs(prev => prev.map(d => d.id === doc.id ? doc : d));
    }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Excluir este documento da base de conhecimento da IA?")) return;
    try {
      const doc = docs.find(d => d.id === id);
      if (doc && doc.tags?.includes("ia_treinada")) {
        await supabase.functions.invoke("wa-doc-embedder", {
          body: {
            doc_id: id,
            project_id: projectId,
            active: false
          }
        });
      }
      
      const { error } = await supabase.from("imphq_docs").delete().eq("id", id);
      if (error) throw error;
      
      setDocs(prev => prev.filter(d => d.id !== id));
      toast.success("Documento excluído com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  useEffect(() => {
    loadConfig();
    loadMetrics();
    fetchDocs();
    fetchUnanswered();
    supabase
      .from("imphq_skills")
      .select("id, nome, descricao")
      .then(({ data }) => setCustomSkills(data || []));
  }, [projectId, providerId]);

  const loadConfig = async () => {
    setLoading(true);
    const query = supabase
      .from("imphq_wa_ai_config")
      .select("*")
      .eq("project_id", projectId);
    
    if (providerId) {
      query.eq("provider_id", providerId);
    } else {
      query.is("provider_id", null);
    }

    const { data } = await query.maybeSingle();
    if (data) {
      setConfig(data as any);
      setKeywordsText((data.escalation_keywords || []).join(", "));
      setIgnoredPhonesText((data.ignored_phones || []).join(", "));
    } else {
      setConfig({
        project_id: projectId,
        provider_id: providerId || null,
        enabled: false,
        personality: "assistente",
        tone: "profissional",
        max_tokens: 300,
        escalation_keywords: ["humano", "atendente", "pessoa", "falar com alguém"],
        welcome_message: "",
        context_sources: ["briefing", "avatar", "produtos", "faq"],
        response_delay_seconds: 3,
        business_hours_only: false,
        business_hours_start: "08:00",
        business_hours_end: "20:00",
        voice_reply_enabled: false,
        voice_provider: "openai",
        voice_name: "alloy",
        voice_stability: 75,
        voice_clarity: 85,
        closer_mode_enabled: true,
        payment_link: "",
      });
      setKeywordsText("humano, atendente, pessoa, falar com alguém");
      setIgnoredPhonesText("");
    }

    // Fetch project products
    const { data: proj } = await supabase
      .from("imphq_projects")
      .select("name, data, owner_phone")
      .eq("id", projectId)
      .maybeSingle();

    if (proj) {
      // Carrega owner_phone no config para exibir no formulário
      if ((proj as any).owner_phone) {
        setConfig(p => ({ ...p, owner_phone: (proj as any).owner_phone } as any));
      }
      const d: any = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
      let list: any[] = [];
      if (Array.isArray(d.produtos)) {
        list = d.produtos.map((p: any) => ({
          nome: p.nome || p.name || "",
          preco: p.preco || p.price || "",
          link: p.link_checkout || p.link || ""
        })).filter((p: any) => p.nome);
      }
      
      const mainProductName = d.produto_principal?.nome || d.produto_principal?.name || d.produto || d.produto_principal || "";
      const mainProductPrice = d.produto_principal?.preco || d.produto_principal?.price || d.preco || "";
      const mainProductLink = d.produto_principal?.link_checkout || d.produto_principal?.link || "";

      if (mainProductName && typeof mainProductName === "string" && !list.some(p => p.nome.toLowerCase() === mainProductName.toLowerCase())) {
        list.unshift({
          nome: mainProductName,
          preco: mainProductPrice,
          link: mainProductLink
        });
      }
      setProjectProducts(list);
    } else {
      setProjectProducts([]);
    }

    // Fetch project leads for testing
    try {
      const { data: leadsData } = await supabase
        .from("imphq_leads")
        .select("id, nome, phone")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (leadsData) {
        setLeads(leadsData);
        if (leadsData.length > 0) {
          setTestPhone(leadsData[0].phone);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar leads para simulação:", err);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);
    const ignored = ignoredPhonesText.split(",").map(n => n.trim()).filter(Boolean);
    const payload: any = {
      ...config,
      escalation_keywords: keywords,
      ignored_phones: ignored,
      provider_id: providerId || null,
      updated_at: new Date().toISOString()
    };
    // owner_phone pertence a imphq_projects, não a imphq_wa_ai_config
    delete payload.owner_phone;

    const { error } = config.id
      ? await supabase.from("imphq_wa_ai_config").update(payload).eq("id", config.id)
      : await supabase.from("imphq_wa_ai_config").insert(payload);

    // Salva owner_phone no projeto (para relatório semanal)
    const ownerPhone = (config as any).owner_phone;
    if (ownerPhone !== undefined && projectId) {
      await supabase
        .from("imphq_projects")
        .update({ owner_phone: ownerPhone || null })
        .eq("id", projectId);
    }

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configurações da IA salvas com sucesso!");
      loadConfig();
    }
    setSaving(false);
  };

  const syncFromProject = async () => {
    const { data: proj } = await supabase
      .from("imphq_projects")
      .select("name, data, brand_kit, avatar")
      .eq("id", projectId)
      .maybeSingle();
    if (!proj) { toast.error("Projeto não encontrado"); return; }
    const d: any = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
    const bk: any = proj.brand_kit || {};
    const expert = d.expert || d.especialista || {};
    const persona = [
      expert?.nome && `Expert: ${expert.nome}`,
      expert?.bio && `Bio: ${expert.bio}`,
      bk?.voice && `Voz da marca: ${bk.voice}`,
      bk?.tom && `Tom: ${bk.tom}`,
    ].filter(Boolean).join("\n");
    const prod = d.produto_principal || d.produtos?.[0];
    const focus = prod ? [
      prod.nome && `Produto: ${prod.nome}`,
      prod.preco && `Preço: ${prod.preco}`,
      (prod.link_checkout || prod.link) && `Link: ${prod.link_checkout || prod.link}`,
    ].filter(Boolean).join(" · ") : "";
    setConfig(p => ({
      ...p,
      expert_persona: p.expert_persona || persona,
      product_focus: p.product_focus || focus,
    }));
    toast.success("Sincronizado com os dados centrais do projeto!");
  };

  const updateFaq = (idx: number, field: "pergunta" | "resposta", value: string) => {
    setConfig(p => {
      const faq = [...(p.faq || [])];
      faq[idx] = { ...faq[idx], [field]: value };
      return { ...p, faq };
    });
  };
  const addFaq = () => setConfig(p => ({ ...p, faq: [...(p.faq || []), { pergunta: "", resposta: "" }] }));
  const removeFaq = (idx: number) => setConfig(p => ({ ...p, faq: (p.faq || []).filter((_, i) => i !== idx) }));

  const toggleContext = (id: string) => {
    setConfig(prev => ({
      ...prev,
      context_sources: prev.context_sources.includes(id)
        ? prev.context_sources.filter(s => s !== id)
        : [...prev.context_sources, id],
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground bg-card rounded-lg border border-border/40">
      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando configurações da IA...
    </div>
  );

  const handleUploadReference = async (file: File) => {
    const ttsUrl = (config as any).local_tts_url?.trim();
    if (!ttsUrl) {
      toast.error("Configure a URL do servidor TTS local primeiro.");
      return;
    }
    setUploadingRef(true);
    setRefUploaded(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${ttsUrl.replace(/\/$/, "")}/reference/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRefUploaded(true);
      toast.success(`Áudio de referência enviado (${data.size_kb ?? "?"} KB). O servidor já usa esta voz.`);
    } catch (e: any) {
      toast.error(`Erro ao enviar áudio: ${e.message}`);
    } finally {
      setUploadingRef(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-lg overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/15 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <Bot className="h-5.5 w-5.5 text-primary" />
              WhatsApp Autônomo (Copiloto & Autoresponder)
            </CardTitle>
            <CardDescription className="text-xs">
              Configure como o cérebro artificial responderá aos seus leads no WhatsApp.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWizardOpen(true)}
              className="h-8 gap-1.5 border-primary/40 hover:bg-primary/10"
            >
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">Wizard rápido</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPackOpen(true)}
              className="h-8 gap-1.5 border-primary/40 hover:bg-primary/10"
            >
              <Package className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">Pack por setor</span>
            </Button>
            <div className="flex items-center gap-2 bg-secondary/50 border border-border/40 px-3 py-1.5 rounded-full">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
              <Badge variant={config.enabled ? "default" : "secondary"} className="text-[10px] font-semibold px-2 py-0.5">
                {config.enabled ? "ATIVO (Auto)" : "INATIVO (Manual)"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <AIWizardDialog
        projectId={projectId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onApplied={() => window.location.reload()}
      />
      <SectorPackDialog
        projectId={projectId}
        open={packOpen}
        onOpenChange={setPackOpen}
        onApplied={() => window.location.reload()}
      />

      <CardContent className="p-0">
        <Tabs defaultValue="behavior" className="w-full">
          {/* Custom elegant Sidebar-like Tab triggers inside the card */}
          <div className="border-b border-border/30 bg-secondary/10 px-4 py-2">
            <TabsList className="bg-background/50 p-1 border border-border/30 w-full flex flex-wrap h-auto gap-1">
              <TabsTrigger value="behavior" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Comportamento
              </TabsTrigger>
              <TabsTrigger value="model" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Server className="h-3.5 w-3.5" /> Conexão & Custo
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Regras & Escalação
              </TabsTrigger>
              <TabsTrigger value="training" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Cérebro & FAQ
              </TabsTrigger>
              <TabsTrigger value="learned" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Brain className="h-3.5 w-3.5" /> Aprendizado
              </TabsTrigger>
              <TabsTrigger value="playground" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Playground de Teste
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5 space-y-6">
            {/* ── TAB 1: COMPOSTAMENTO ── */}
            <TabsContent value="behavior" className="mt-0 space-y-4 animate-fade-in">
              {/* Toggles Strip */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`p-4 rounded-lg border transition-all ${config.enabled ? "bg-primary/5 border-primary/20" : "bg-secondary/20 border-border/40"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <Zap className={`h-4 w-4 ${config.enabled ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                        Autoresponder Ativo
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Quando ativo, a IA enviará mensagens autônomas para leads recebidos. Quando inativo, ela apenas gerará rascunhos.
                      </p>
                    </div>
                    <Switch checked={config.enabled} onCheckedChange={v => setConfig(p => ({ ...p, enabled: v }))} className="mt-1" />
                  </div>
                </div>

                <div className={`p-4 rounded-lg border transition-all ${(config as any).draft_mode === true ? "bg-amber-500/5 border-amber-500/20" : "bg-secondary/20 border-border/40"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                        Modo Rascunho (Copiloto)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        A IA elabora a resposta perfeita no chat, mas **não envia**. Você revisa, edita e aprova com 1 clique antes do disparo.
                      </p>
                    </div>
                    <Switch checked={(config as any).draft_mode === true} onCheckedChange={v => setConfig(p => ({ ...p, draft_mode: v } as any))} className="mt-1" />
                  </div>
                </div>
              </div>

              {/* Personality & Tone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Brain className="h-3.5 w-3.5 text-primary" /> Personalidade Base
                  </Label>
                  <Select value={config.personality} onValueChange={v => setConfig(p => ({ ...p, personality: v }))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {PERSONALITIES.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          <span className="font-semibold text-foreground">{p.label}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{p.desc}</span>
                        </SelectItem>
                      ))}
                      {MENTES_DATA.map(m => (
                        <SelectItem key={`skill_${m.id}`} value={`skill_${m.id}`} className="text-xs">
                          <span className="font-semibold text-primary">🧠 Mente: {m.nome}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{m.role} · {m.spec}</span>
                        </SelectItem>
                      ))}
                      {customSkills.map(s => (
                        <SelectItem key={`skill_${s.id}`} value={`skill_${s.id}`} className="text-xs">
                          <span className="font-semibold text-amber-500">✨ Skill: {s.nome}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{s.descricao || "Mente IA customizada"}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Sliders className="h-3.5 w-3.5 text-primary" /> Tom de Voz / Linguagem
                  </Label>
                  <Select value={config.tone} onValueChange={v => setConfig(p => ({ ...p, tone: v }))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONES.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Delay & Welcome Message */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Tempo de Simulação (Delay)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={config.response_delay_seconds}
                      onChange={e => setConfig(p => ({ ...p, response_delay_seconds: parseInt(e.target.value) || 3 }))}
                      className="text-xs bg-secondary/40 border-border/30 h-9.5 pr-10"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-muted-foreground">seg</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    Simula digitação humana antes de enviar a resposta.
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Mensagem de Boas-Vindas Inicial (opcional)</Label>
                  <Textarea
                    value={config.welcome_message}
                    onChange={e => setConfig(p => ({ ...p, welcome_message: e.target.value }))}
                    placeholder="Ex: Olá! Vi seu interesse e já vou te passar as informações. Me diz, você já conhece o projeto?"
                    className="min-h-[50px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed"
                  />
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    Se preenchido, dispara esse texto no primeiro contato antes de acionar a inteligência artificial.
                  </p>
                </div>
              </div>

              {/* Closer Mode & Link de Pagamento */}
              <div className="border-t border-border/20 pt-4 mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" /> Modo Closer Automático
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Quando o lead demonstrar intenção de compra, a IA focará agressivamente em fechar a venda de forma ágil.
                    </p>
                  </div>
                  <Switch 
                    checked={config.closer_mode_enabled !== false} 
                    onCheckedChange={v => setConfig(p => ({ ...p, closer_mode_enabled: v }))} 
                  />
                </div>

                {config.closer_mode_enabled !== false && (
                  <div className="space-y-1.5 border border-border/30 bg-secondary/10 p-4 rounded-xl animate-fade-in">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      🔗 Link Geral de Checkout / Pagamento
                    </Label>
                    <Input
                      placeholder="https://checkout.ticto.app/O854B666F"
                      value={config.payment_link || ""}
                      onChange={e => setConfig(p => ({ ...p, payment_link: e.target.value }))}
                      className="text-xs bg-secondary/40 border-border/30 h-9.5"
                    />
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      💡 **Dica de link dinâmico**: A IA procurará automaticamente o link específico correspondente ao nome do produto na lista de "Oferta Ativa". Caso não encontre um link específico para o produto, ela usará esse Link Geral de Checkout.
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      ⚠️ **Handoff Humano**: Se a IA não encontrar nenhum link correspondente (nem de produto específico, nem esse Link Geral), ela dirá *"Vou te passar o link agora, me dá um segundo."* e transferirá a conversa para um atendente real (IA pausará e notificará a equipe).
                    </p>

                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 pt-2">
                      💠 Chave Pix Oficial (opcional)
                    </Label>
                    <Input
                      placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                      value={(config as any).pix_key || ""}
                      onChange={e => setConfig(p => ({ ...p, pix_key: e.target.value } as any))}
                      className="text-xs bg-secondary/40 border-border/30 h-9.5 font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Se preenchida, a IA usa EXATAMENTE esta chave quando o lead pedir Pix. Se vazia, a IA <strong>nunca inventa</strong> dados — orienta o lead a refazer a compra pelo link de checkout, onde o Pix já está disponível.
                    </p>
                  </div>
                )}
              </div>

              {/* Relatório Semanal Automático */}
              <div className="border-t border-border/20 pt-4 mt-2 space-y-3">
                <div>
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    📊 Relatório Semanal Automático
                  </Label>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                    Toda segunda-feira às 08h você receberá um resumo da semana: conversões, leads ativos, fluxos com melhor ROI e perguntas sem resposta. Informe seu número do WhatsApp abaixo.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Seu número (WhatsApp) para receber o relatório</Label>
                  <Input
                    placeholder="5511999999999"
                    value={(config as any).owner_phone || ""}
                    onChange={e => setConfig(p => ({ ...p, owner_phone: e.target.value } as any))}
                    className="text-xs bg-secondary/40 border-border/30 h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">Apenas números, com DDI + DDD. Ex: 5511999887766</p>
                </div>
              </div>

              {/* Voice Configuration */}
              <div className="border-t border-border/20 pt-4 mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Mic className="h-4 w-4 text-primary" /> Resposta por Voz Ativa
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      A IA responderá automaticamente usando áudio sintetizado (PTT) simulando gravação humana.
                    </p>
                  </div>
                  <Switch 
                    checked={config.voice_reply_enabled === true} 
                    onCheckedChange={v => setConfig(p => ({ ...p, voice_reply_enabled: v }))} 
                  />
                </div>

                {config.voice_reply_enabled && (
                  <div className="space-y-4 border border-border/30 bg-secondary/10 p-4 rounded-xl animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Provedor de Voz</Label>
                        <Select
                          value={config.voice_provider || "openai"}
                          onValueChange={v => setConfig(p => ({ ...p, voice_provider: v }))}
                        >
                          <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai" className="text-xs">☁️ OpenAI TTS (Kits de Voz Padrão)</SelectItem>
                            <SelectItem value="elevenlabs" className="text-xs">☁️ ElevenLabs (Vozes Clonadas HD)</SelectItem>
                            <SelectItem value="local" className="text-xs">🖥️ Servidor Local — edge-tts (Gratuito, pt-BR)</SelectItem>
                            <SelectItem value="local_clone" className="text-xs">🖥️ Servidor Local — Voz Clonada XTTS v2 (Expert)</SelectItem>
                          </SelectContent>
                        </Select>
                        {(config.voice_provider === "local" || config.voice_provider === "local_clone") && (
                          <p className="text-[9px] text-amber-500/80 leading-relaxed">
                            ⚠️ Requer o servidor Python rodando na sua máquina. Veja as instruções abaixo.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          {config.voice_provider === "local" ? "Voz pt-BR (edge-tts)" :
                           config.voice_provider === "local_clone" ? "Identificador da Voz Clonada" :
                           "Avatar de Voz (Voice ID)"}
                        </Label>

                        {config.voice_provider === "openai" && (
                          <Select
                            value={config.voice_name || "alloy"}
                            onValueChange={v => setConfig(p => ({ ...p, voice_name: v }))}
                          >
                            <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="alloy" className="text-xs">Alloy (Neutro)</SelectItem>
                              <SelectItem value="echo" className="text-xs">Echo (Masculino Neutro)</SelectItem>
                              <SelectItem value="fable" className="text-xs">Fable (Narrativa)</SelectItem>
                              <SelectItem value="onyx" className="text-xs">Onyx (Masculino Profundo)</SelectItem>
                              <SelectItem value="nova" className="text-xs">Nova (Feminino Enérgico)</SelectItem>
                              <SelectItem value="shimmer" className="text-xs">Shimmer (Feminino Profissional)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {config.voice_provider === "local" && (
                          <>
                            <Select
                              value={config.voice_name || "pt-BR-FranciscaNeural"}
                              onValueChange={v => setConfig(p => ({ ...p, voice_name: v }))}
                            >
                              <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pt-BR-FranciscaNeural" className="text-xs">Francisca (Feminino, padrão)</SelectItem>
                                <SelectItem value="pt-BR-AntonioNeural" className="text-xs">Antonio (Masculino)</SelectItem>
                                <SelectItem value="pt-BR-BrendaNeural" className="text-xs">Brenda (Feminino)</SelectItem>
                                <SelectItem value="pt-BR-DonatoNeural" className="text-xs">Donato (Masculino)</SelectItem>
                                <SelectItem value="pt-BR-GiovannaNeural" className="text-xs">Giovanna (Feminino)</SelectItem>
                                <SelectItem value="pt-BR-HumbertoNeural" className="text-xs">Humberto (Masculino)</SelectItem>
                                <SelectItem value="pt-BR-JulioNeural" className="text-xs">Julio (Masculino)</SelectItem>
                                <SelectItem value="pt-BR-LeticiaNeural" className="text-xs">Leticia (Feminino)</SelectItem>
                                <SelectItem value="pt-BR-ManuelaNeural" className="text-xs">Manuela (Feminino)</SelectItem>
                                <SelectItem value="pt-BR-YaraNeural" className="text-xs">Yara (Feminino)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                              Vozes Microsoft gratuitas via edge-tts. 100% local, custo zero.
                            </p>
                          </>
                        )}

                        {config.voice_provider === "local_clone" && (
                          <>
                            <Input
                              placeholder="ex: jp-expert (identificador livre)"
                              value={config.voice_name || ""}
                              onChange={e => setConfig(p => ({ ...p, voice_name: e.target.value }))}
                              className="text-xs bg-secondary/40 border-border/30 h-9.5"
                            />
                            <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                              Apenas um rótulo. O servidor usa o arquivo <code>reference.wav</code> como voz de referência.
                            </p>
                          </>
                        )}

                        {config.voice_provider === "elevenlabs" && (
                          <div className="space-y-2">
                            {/* Instrução para voz clonada */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-[10px] text-amber-200/80 leading-relaxed">
                              💡 <strong>Para usar voz clonada (ex: JP):</strong> No painel do ElevenLabs, vá em <em>Voices → sua voz clonada → copie o Voice ID</em> e cole no campo abaixo. As vozes clonadas aparecem na lista como categoria <em>"cloned"</em>.
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={elevenLabsVoices.some(v => v.id === config.voice_name) ? (config.voice_name || "") : "custom"}
                                onValueChange={v => {
                                  if (v === "custom") {
                                    setConfig(p => ({ ...p, voice_name: "" }));
                                  } else {
                                    setConfig(p => ({ ...p, voice_name: v }));
                                  }
                                }}
                              >
                                <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5 flex-1">
                                  <SelectValue placeholder="Selecione uma voz do ElevenLabs" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {elevenLabsLoading ? (
                                    <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                                      <Loader2 className="h-3 w-3 animate-spin mr-1 text-primary" /> Carregando vozes...
                                    </div>
                                  ) : elevenLabsVoices.length === 0 ? (
                                    <div className="p-2 text-xs text-muted-foreground italic text-center">
                                      Nenhuma voz encontrada. Use Voice ID manual.
                                    </div>
                                  ) : (
                                    elevenLabsVoices.map(v => (
                                      <SelectItem key={v.id} value={v.id} className="text-xs">
                                        {v.name} ({v.category})
                                      </SelectItem>
                                    ))
                                  )}
                                  <SelectItem value="custom" className="text-xs text-amber-500 font-semibold">
                                    + Digitar Voice ID Manual...
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9.5 w-9.5 shrink-0"
                                onClick={fetchElevenLabsVoices}
                                disabled={elevenLabsLoading}
                                title="Recarregar vozes do ElevenLabs"
                              >
                                <RefreshCw className={`h-4 w-4 ${elevenLabsLoading ? "animate-spin" : ""}`} />
                              </Button>
                            </div>

                            {(() => {
                              const selectedVoice = elevenLabsVoices.find(v => v.id === config.voice_name);
                              if (!selectedVoice?.preview_url) return null;
                              return (
                                <div className="flex items-center gap-2 bg-background/50 border border-border/30 px-3 py-1.5 rounded-lg animate-fade-in">
                                  <span className="text-[10px] text-muted-foreground font-medium">Prévia:</span>
                                  <audio controls src={selectedVoice.preview_url} className="h-6 w-full max-w-[220px]" />
                                </div>
                              );
                            })()}

                            {(config.voice_name === "custom" ||
                              (!elevenLabsVoices.some(v => v.id === config.voice_name) && !elevenLabsLoading)) && (
                              <Input
                                placeholder="Cole o Voice ID do ElevenLabs aqui (ex: abc123de-...)"
                                value={config.voice_name === "custom" ? "" : config.voice_name || ""}
                                onChange={e => setConfig(p => ({ ...p, voice_name: e.target.value }))}
                                className="text-xs bg-secondary/40 border-border/30 h-9.5 mt-1.5 font-mono"
                              />
                            )}

                            {/* Confirmação do Voice ID ativo */}
                            {config.voice_name && config.voice_name !== "custom" && (
                              <div className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-1.5 text-[10px]">
                                <span className="text-muted-foreground">Voice ID ativo:</span>
                                <code className="text-primary font-mono truncate max-w-[200px]">{config.voice_name}</code>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground/60">
                              <a href="https://elevenlabs.io/app/voice-lab" target="_blank" rel="noreferrer" className="underline hover:text-primary">
                                Abrir ElevenLabs Voice Lab →
                              </a>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── LOCAL TTS URL (local / local_clone) ── */}
                    {(config.voice_provider === "local" || config.voice_provider === "local_clone") && (
                      <div className="space-y-3 border-t border-border/20 pt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5 text-primary" /> URL do Servidor TTS Local
                          </Label>
                          <Input
                            placeholder="https://seu-tunnel.trycloudflare.com  ou  http://localhost:8765"
                            value={(config as any).local_tts_url || ""}
                            onChange={e => setConfig(p => ({ ...p, local_tts_url: e.target.value } as any))}
                            className="text-xs bg-secondary/40 border-border/30 h-9.5 font-mono"
                          />
                          <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
                            A Edge Function do Supabase precisa alcançar essa URL. Use o Cloudflare Tunnel para expor sua máquina publicamente.
                          </p>
                        </div>

                        <div className="bg-background/60 border border-border/30 rounded-lg p-3 space-y-2">
                          <p className="text-[10px] font-semibold text-foreground">🚀 Como iniciar o servidor na sua máquina:</p>
                          <div className="space-y-1 font-mono text-[9px] text-muted-foreground bg-secondary/30 rounded p-2 leading-relaxed">
                            <p className="text-primary/80"># 1. Instale as dependências (só na primeira vez)</p>
                            <p>cd local-tts-server</p>
                            {config.voice_provider === "local"
                              ? <p>pip install edge-tts fastapi uvicorn</p>
                              : <p>pip install edge-tts fastapi uvicorn TTS torch torchaudio</p>
                            }
                            <p className="text-primary/80 mt-1"># 2. Inicie o servidor</p>
                            {config.voice_provider === "local"
                              ? <p>XTTS_ENABLED=false python server.py</p>
                              : <p>{"python server.py  # ~4GB download na 1ª vez"}</p>
                            }
                            <p className="text-primary/80 mt-1"># 3. Exponha publicamente (Cloudflare Tunnel, gratuito)</p>
                            <p>cloudflared tunnel --url http://localhost:8765</p>
                            <p className="text-primary/80 mt-1"># Cole a URL gerada (*.trycloudflare.com) acima ↑</p>
                          </div>
                          {config.voice_provider === "local_clone" && (
                            <div className="space-y-2 mt-1">
                              <p className="text-[9px] text-amber-500/80 leading-relaxed">
                                📎 Envie o áudio de referência do expert (10–30s, sem ruído, .wav/.mp3).
                              </p>
                              {/* Upload de áudio de referência */}
                              <div className="flex items-center gap-2">
                                <input
                                  ref={refAudioInputRef}
                                  type="file"
                                  accept=".wav,.mp3,.ogg,.m4a"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadReference(file);
                                    e.target.value = "";
                                  }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] gap-1.5 border-dashed border-primary/40 hover:border-primary/70"
                                  disabled={uploadingRef}
                                  onClick={() => refAudioInputRef.current?.click()}
                                >
                                  {uploadingRef
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : refUploaded
                                      ? <CheckCircle className="h-3 w-3 text-green-400" />
                                      : <Upload className="h-3 w-3" />
                                  }
                                  {uploadingRef ? "Enviando..." : refUploaded ? "Voz enviada ✓" : "Enviar áudio de referência"}
                                </Button>
                                {refUploaded && (
                                  <span className="text-[9px] text-green-400">O servidor já usa esta voz</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── ElevenLabs fallback key (local_clone only) ── */}
                    {config.voice_provider === "local_clone" && (
                      <div className="space-y-1.5 border-t border-border/20 pt-3">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Chave ElevenLabs (fallback automático se servidor offline)
                        </Label>
                        <Input
                          type="password"
                          placeholder="sk_... (opcional — usado apenas se o servidor local falhar)"
                          value={(config as any).elevenlabs_api_key || ""}
                          onChange={e => setConfig(p => ({ ...p, elevenlabs_api_key: e.target.value } as any))}
                          className="text-xs bg-secondary/40 border-border/30 h-9.5 font-mono"
                        />
                        <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                          Se o servidor local não responder em 30s, o sistema usa o ElevenLabs com a Voice ID configurada acima como backup automático.
                        </p>
                      </div>
                    )}

                    {/* ── ElevenLabs sliders (elevenlabs provider) ── */}
                    {config.voice_provider === "elevenlabs" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/20">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Estabilidade</span>
                            <span>{config.voice_stability || 75}%</span>
                          </div>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={config.voice_stability || 75}
                            onChange={e => setConfig(p => ({ ...p, voice_stability: parseInt(e.target.value) }))}
                            className="h-7 accent-primary"
                          />
                          <span className="text-[9px] text-muted-foreground/60 leading-none block">Valores maiores deixam a fala mais estável, menores adicionam mais emoção e ruídos de respiração.</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Clareza / Similaridade</span>
                            <span>{config.voice_clarity || 85}%</span>
                          </div>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={config.voice_clarity || 85}
                            onChange={e => setConfig(p => ({ ...p, voice_clarity: parseInt(e.target.value) }))}
                            className="h-7 accent-primary"
                          />
                          <span className="text-[9px] text-muted-foreground/60 leading-none block">Aumenta a fidelidade com a voz original. Valores muito altos podem causar pequenos ruídos.</span>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── TAB 2: MODEL & COST ── */}
            <TabsContent value="model" className="mt-0 space-y-4 animate-fade-in">
              {/* Telemetry Dashboard */}
              <div className="space-y-4 border-b border-border/20 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs font-bold text-foreground">Monitor de Latência e Custos da IA (Últimos 30 dias)</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={loadMetrics} disabled={metricsLoading}>
                    <RefreshCw className={`h-3 w-3 ${metricsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Latency card */}
                  <Card className="bg-secondary/10 border-border/20 p-3 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tempo de Resposta</p>
                      <p className="text-lg font-bold text-foreground">
                        {metricsLoading ? "..." : `${metrics.avgLatency.toFixed(2)}s`}
                      </p>
                      <p className="text-[9px] text-muted-foreground">Média das chamadas com sucesso</p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                  </Card>

                  {/* Cost card */}
                  <Card className="bg-secondary/10 border-border/20 p-3 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custo de API</p>
                      <p className="text-lg font-bold text-foreground">
                        {metricsLoading ? "..." : `R$ ${(metrics.totalCost * 5.5).toFixed(2)}`}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {metricsLoading ? "..." : `$${metrics.totalCost.toFixed(4)} USD · ${metrics.totalCalls} msgs`}
                      </p>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg shrink-0">
                      <Bot className="h-4 w-4 text-green-500" />
                    </div>
                  </Card>

                  {/* Success rate card */}
                  <Card className="bg-secondary/10 border-border/20 p-3 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Taxa de Sucesso</p>
                      <p className="text-lg font-bold text-foreground">
                        {metricsLoading ? "..." : `${metrics.successRate.toFixed(1)}%`}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {metricsLoading ? "..." : `${metrics.successCalls} OK · ${metrics.failedCalls} falhas`}
                      </p>
                    </div>
                    <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                      <CheckCircle className="h-4 w-4 text-indigo-500" />
                    </div>
                  </Card>
                </div>

                {/* Latest Logs list */}
                {logs.length > 0 && (
                  <Card className="border-border/20 bg-secondary/5 overflow-hidden">
                    <CardHeader className="p-3 border-b border-border/25 bg-secondary/10">
                      <CardTitle className="text-[11px] font-bold flex items-center gap-1.5">
                        <Server className="h-3.5 w-3.5 text-muted-foreground" /> Últimas Requisições da IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/20 text-[10px] max-h-[220px] overflow-y-auto">
                        {logs.map((log, i) => (
                          <div key={log.id || i} className="p-2.5 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Badge variant={log.success ? "secondary" : "destructive"} className="text-[9px] px-1 h-4 py-0 font-normal">
                                  {log.success ? "OK" : "Erro"}
                                </Badge>
                                <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                                  {log.model?.replace("openai/", "").replace("google/", "") || "—"}
                                </span>
                              </div>
                              {log.success ? (
                                <p className="text-[9px] text-muted-foreground">
                                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {log.prompt_tokens + log.completion_tokens} tokens
                                </p>
                              ) : (
                                <p className="text-[9px] text-destructive truncate max-w-[180px] sm:max-w-[240px]" title={log.error_message || ""}>
                                  {log.error_message || "Erro desconhecido"}
                                </p>
                              )}
                            </div>
                            <div className="text-right space-y-0.5">
                              <p className="font-bold text-foreground">{log.latency_seconds ? `${Number(log.latency_seconds).toFixed(1)}s` : "—"}</p>
                              <p className="text-[9px] text-green-500 font-semibold">
                                {log.cost_usd ? `R$ ${(log.cost_usd * 5.5).toFixed(4)}` : "R$ 0,00"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="bg-primary/5 rounded-lg border border-primary/10 p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-foreground">Conecte seus modelos favoritos</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Você pode usar nossa infraestrutura integrada (Lovable AI) sem custos adicionais, ou plugar sua chave do **OpenRouter** para usar modelos avançados como **Claude 3.5 Sonnet**, **DeepSeek V3** e **GPT-4o** pagando apenas os centavos de centavos que você consome.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Provedor de IA (Gateway)</Label>
                  <Select value={(config as any).ai_provider || "lovable"} onValueChange={v => setConfig(p => ({ ...p, ai_provider: v } as any))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lovable" className="text-xs">Lovable AI (Gemini, GPT-5 Integrado)</SelectItem>
                      <SelectItem value="openrouter" className="text-xs">OpenRouter (Modelos Customizados)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Modelo de Linguagem (LLM)</Label>
                  <Select value={(config as any).ai_model || ""} onValueChange={v => setConfig(p => ({ ...p, ai_model: v } as any))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue placeholder="Padrão do sistema (Flash)" /></SelectTrigger>
                    <SelectContent>
                      {((config as any).ai_provider === "openrouter" ? [
                        "anthropic/claude-3.5-sonnet",
                        "anthropic/claude-3.5-haiku",
                        "openai/gpt-4o",
                        "openai/gpt-4o-mini",
                        "google/gemini-2.5-pro",
                        "google/gemini-2.5-flash",
                        "meta-llama/llama-3.3-70b-instruct",
                        "deepseek/deepseek-chat",
                        "mistralai/mistral-large",
                      ] : [
                        "google/gemini-3-flash-preview",
                        "google/gemini-2.5-pro",
                        "google/gemini-2.5-flash",
                        "openai/gpt-5-mini",
                        "openai/gpt-5",
                      ]).map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Parameters */}
              <div className="bg-secondary/15 rounded-lg border border-border/30 p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/20 pb-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Hiperparâmetros do Modelo</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <Label className="font-semibold text-muted-foreground">Criatividade (Temp: {Number((config as any).ai_temperature ?? 0.7).toFixed(1)})</Label>
                    </div>
                    <input type="range" min={0} max={1.5} step={0.1}
                      value={(config as any).ai_temperature ?? 0.7}
                      onChange={e => setConfig(p => ({ ...p, ai_temperature: parseFloat(e.target.value) } as any))}
                      className="w-full h-1.5 bg-secondary accent-primary rounded-lg cursor-pointer" />
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Valores menores = mais estável e direto. Valores maiores = mais criativo e variado.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <Label className="font-semibold text-muted-foreground">Filtro Top P ({Number((config as any).ai_top_p ?? 1).toFixed(1)})</Label>
                    </div>
                    <input type="range" min={0.1} max={1} step={0.1}
                      value={(config as any).ai_top_p ?? 1}
                      onChange={e => setConfig(p => ({ ...p, ai_top_p: parseFloat(e.target.value) } as any))}
                      className="w-full h-1.5 bg-secondary accent-primary rounded-lg cursor-pointer" />
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Limita o vocabulário avaliado pela IA para reduzir gírias ou repetições.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Limite de Resposta (Tokens)</Label>
                    <Input
                      type="number"
                      min={50}
                      max={1500}
                      value={config.max_tokens}
                      onChange={e => setConfig(p => ({ ...p, max_tokens: parseInt(e.target.value) || 300 }))}
                      className="text-xs bg-secondary/40 border-border/30 h-8"
                    />
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Evita respostas extremamente longas. 300 tokens equivalem a ~200 palavras.
                    </p>
                  </div>
                </div>
              </div>

              {/* Autolearning mode */}
              <div className="p-4 rounded-lg border border-border/30 bg-secondary/10 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-4 w-4 text-primary animate-pulse" />
                    <p className="text-xs font-bold text-foreground">Aprendizado de Máquina (Auto-Learning)</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Indexa automaticamente respostas que você dá no chat humano <strong>e também pelo celular</strong>. O cérebro da IA fica mais inteligente a cada conversa real.
                  </p>
                </div>
                <Switch checked={(config as any).learning_mode !== false}
                  onCheckedChange={v => setConfig(p => ({ ...p, learning_mode: v } as any))} />
              </div>

              {/* Backfill histórico */}
              <div className="p-4 rounded-lg border border-border/30 bg-secondary/10 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Aprender do histórico</p>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Varre as suas respostas humanas dos últimos 30 dias e indexa na knowledge base. Use uma vez após ativar o aprendizado.
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={backfillLoading}
                  onClick={async () => {
                    setBackfillLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("wa-learn-backfill", {
                        body: { project_id: projectId, days: 30, limit: 500 },
                      });
                      if (error) throw error;
                      toast.success(`✓ ${data?.aprendidas || 0} aprendidas · ${data?.dedupadas || 0} já existiam · ${data?.puladas || 0} puladas`);
                    } catch (e: any) {
                      toast.error(e?.message || "Erro no backfill");
                    } finally {
                      setBackfillLoading(false);
                    }
                  }}>
                  {backfillLoading ? "Processando…" : "Rodar agora"}
                </Button>
              </div>
            </TabsContent>

            {/* ── TAB 3: RULES & ESCALATION ── */}
            <TabsContent value="rules" className="mt-0 space-y-5 animate-fade-in">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Shield className="h-4 w-4 text-primary" /> Palavras de Parada & Escalação Humana
                </Label>
                <div className="p-3 bg-secondary/20 rounded border border-border/40 space-y-2.5">
                  <Input
                    value={keywordsText}
                    onChange={e => setKeywordsText(e.target.value)}
                    placeholder="ex: humano, falar com atendente, suporte, pessoa, help"
                    className="text-xs bg-background border-border/30 h-10"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    💡 **Como funciona:** Separe por vírgulas. Sempre que o lead digitar qualquer uma destas palavras (ou sinônimos diretos), a IA **desativa a si mesma automaticamente** na conversa, marca a conversa como pendente de suporte e emite alerta visual. Isso evita conversas repetitivas e loops irritantes para o cliente.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-border/20">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Bot className="h-4 w-4 text-primary" /> Contatos Ignorados (Blacklist de Leads)
                </Label>
                <div className="p-3 bg-secondary/20 rounded border border-border/40 space-y-2.5">
                  <Input
                    value={ignoredPhonesText}
                    onChange={e => setIgnoredPhonesText(e.target.value)}
                    placeholder="ex: +5511999999999, 5511888888888"
                    className="text-xs bg-background border-border/30 h-10"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Separe por vírgulas. A IA nunca responderá automaticamente a estes números de telefone (leads). Útil para o seu próprio número, parceiros ou clientes sob suporte manual.
                  </p>
                </div>
              </div>

              <div className="bg-secondary/15 rounded-lg border border-border/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" /> Limitar ao Horário de Atendimento
                    </span>
                    <p className="text-[10px] text-muted-foreground max-w-md leading-normal">
                      Evita respostas automáticas nos finais de semana ou fora do horário comercial, permitindo humanizar o atendimento.
                    </p>
                  </div>
                  <Switch
                    checked={config.business_hours_only}
                    onCheckedChange={v => setConfig(p => ({ ...p, business_hours_only: v }))}
                  />
                </div>

                {config.business_hours_only && (
                  <div className="flex items-center gap-2 bg-background/50 p-3 rounded border border-border/30 w-fit animate-slide-in">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Início do Turno</Label>
                      <Input
                        value={config.business_hours_start}
                        onChange={e => setConfig(p => ({ ...p, business_hours_start: e.target.value }))}
                        className="w-24 h-8 text-xs font-mono text-center bg-secondary/20 border-border/30"
                      />
                    </div>
                    <span className="text-muted-foreground font-light text-sm mt-4">até</span>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Término do Turno</Label>
                      <Input
                        value={config.business_hours_end}
                        onChange={e => setConfig(p => ({ ...p, business_hours_end: e.target.value }))}
                        className="w-24 h-8 text-xs font-mono text-center bg-secondary/20 border-border/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── TAB 4: TRAINING & FAQ ── */}
            <TabsContent value="training" className="mt-0 space-y-5 animate-fade-in">
              <div className="flex items-center justify-between gap-3 border-b border-border/20 pb-3 flex-wrap">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Brain className="h-4 w-4 text-primary" /> Alavancagem de Contexto
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    Marque quais pilares informativos do projeto esta IA deve levar em consideração ao formular respostas.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={syncFromProject}>
                    <RefreshCw className="h-3.5 w-3.5" /> Puxar dados do projeto
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/5" onClick={() => setRefineOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5" /> Refinar cérebro
                  </Button>
                </div>
              </div>

              {/* Context checklist bubbles */}
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground font-semibold">Bancos de Conhecimento Ativados</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {CONTEXT_OPTIONS.map(opt => {
                    const active = config.context_sources.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleContext(opt.id)}
                        className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                          active
                            ? "bg-primary/5 border-primary/30 text-primary"
                            : "bg-secondary/15 border-border/20 hover:border-border/40 text-muted-foreground"
                        }`}
                      >
                        <div className={`mt-0.5 rounded-full p-0.5 ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <CheckCircle className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">{opt.label}</p>
                          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Persona Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    👑 Persona do Expert
                  </Label>
                  <Textarea
                    value={config.expert_persona || ""}
                    onChange={e => setConfig(p => ({ ...p, expert_persona: e.target.value }))}
                    placeholder="Descreva a postura, autoridade e biografia que a IA assumirá ao falar no singular."
                    className="min-h-[100px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    🚫 Instruções e Barreiras Mandatórias
                  </Label>
                  <Textarea
                    value={config.custom_instructions || ""}
                    onChange={e => setConfig(p => ({ ...p, custom_instructions: e.target.value }))}
                    placeholder="Regras inquebráveis: Ex: 'Nunca prometa desconto', 'Se perguntarem do prazo, diga 7 dias', 'Evite responder sobre outros nichos'."
                    className="min-h-[100px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    ⛔ Frases Proibidas (vícios da IA)
                  </Label>
                  <Textarea
                    value={(config.banned_phrases || []).join("\n")}
                    onChange={e => setConfig(p => ({ ...p, banned_phrases: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) }))}
                    placeholder={"Uma frase por linha. Ex:\nFaz todo sentido\nImagina!\nEntendo perfeitamente\nQue legal"}
                    className="min-h-[80px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Frases que a IA <strong>nunca</strong> deve usar. Útil para bloquear clichês de bot que você notar nas conversas (ex: <em>"Faz todo sentido querer..."</em>). Uma frase por linha.
                  </p>
                </div>

                <div className="space-y-3 p-3.5 rounded-lg bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20">
                  <div className="flex items-center gap-2 pb-1 border-b border-indigo-500/10">
                    <Brain className="h-4 w-4 text-indigo-400" />
                    <Label className="text-xs font-bold text-foreground">Autonomia da IA</Label>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        🌙 Self-audit noturno (03h)
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Toda madrugada analisa conversas onde leads sumiram/pediram humano e <strong>auto-adiciona frases proibidas e regras</strong>.
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_audit_enabled || false}
                      onCheckedChange={(checked) => setConfig(p => ({ ...p, auto_audit_enabled: checked }))}
                    />
                  </div>
                  {config.last_audit_at && (
                    <p className="text-[10px] text-indigo-400 font-mono pl-1 -mt-1">
                      Último: {new Date(config.last_audit_at).toLocaleString("pt-BR")}
                      {Array.isArray(config.audit_findings) && config.audit_findings.length > 0 && config.audit_findings[0] && (
                        <span className="text-muted-foreground ml-2">
                          · {config.audit_findings[0].phrases_added?.length || 0}f, {config.audit_findings[0].rules_added?.length || 0}r
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-500/10">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        🧬 Self-tune semanal (segunda 04h)
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Toda segunda compara <strong>conversas que viraram venda vs que não viraram</strong> e propõe ajustes no prompt baseado em padrões reais.
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_tune_enabled || false}
                      onCheckedChange={(checked) => setConfig(p => ({ ...p, auto_tune_enabled: checked }))}
                    />
                  </div>
                  {config.auto_tune_enabled && (
                    <div className="flex items-center justify-between gap-3 pl-3 -mt-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Aplicar mudanças automaticamente <span className="text-amber-400">(senão, só propõe)</span>
                      </Label>
                      <Switch
                        checked={config.auto_tune_apply || false}
                        onCheckedChange={(checked) => setConfig(p => ({ ...p, auto_tune_apply: checked }))}
                      />
                    </div>
                  )}
                  {config.last_tune_at && (
                    <p className="text-[10px] text-purple-400 font-mono pl-1 -mt-1">
                      Último: {new Date(config.last_tune_at).toLocaleString("pt-BR")}
                      {Array.isArray(config.tune_history) && config.tune_history.length > 0 && config.tune_history[0] && (
                        <span className="text-muted-foreground ml-2">
                          · {config.tune_history[0].wins_analyzed}w vs {config.tune_history[0].losses_analyzed}l · {config.tune_history[0].applied ? "aplicado" : "proposto"}
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-500/10">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        🚨 Auto-escalation semântica (20min)
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        IA decide sozinha quando passar pra humano <strong>sem precisar de keyword</strong>. Detecta frustração, loop, lead esfriando.
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_escalation_enabled || false}
                      onCheckedChange={(checked) => setConfig(p => ({ ...p, auto_escalation_enabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-500/10">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        🎭 Drift de persona (semanal)
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Toda segunda, IA compara as respostas reais com a persona configurada e <strong>reforça quando começa a falar diferente</strong>.
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_drift_enabled || false}
                      onCheckedChange={(checked) => setConfig(p => ({ ...p, auto_drift_enabled: checked }))}
                    />
                  </div>
                  {config.last_drift_at && config.drift_score != null && (
                    <p className="text-[10px] font-mono pl-1 -mt-1">
                      <span className={Number(config.drift_score) < 60 ? "text-amber-400" : "text-emerald-400"}>
                        Score persona: {config.drift_score}/100
                      </span>
                      <span className="text-muted-foreground ml-2">· {new Date(config.last_drift_at).toLocaleDateString("pt-BR")}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-500/10">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        📊 Pontuar conversas + postmortem (4h)
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Toda conversa encerrada ganha <strong>score 0-100 + postmortem</strong> (o que funcionou, o que falhou). Alimenta dashboards e o self-tune.
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_scoring_enabled || false}
                      onCheckedChange={(checked) => setConfig(p => ({ ...p, auto_scoring_enabled: checked }))}
                    />
                  </div>
                </div>
              </div>

              {/* Product and Focus details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">Produto / Oferta Principal em Foco</Label>
                  <p className="text-[10px] text-muted-foreground">Clique para selecionar um ou mais produtos do projeto. A IA focará em convertê-los na conversa.</p>
                </div>

                {projectProducts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
                    {projectProducts.map((prod, idx) => {
                      const selected = isProductSelected(prod.nome);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleProduct(prod)}
                          className={`text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                            selected
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-secondary/20 border-border/40 hover:border-border/60 text-muted-foreground"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-semibold truncate text-foreground">{prod.nome}</p>
                            {prod.preco && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Preço: {prod.preco}</p>
                            )}
                            {prod.link && (
                              <p className="text-[9px] text-muted-foreground truncate mt-0.5">{prod.link}</p>
                            )}
                          </div>
                          <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                            {selected && <CheckCircle className="h-3.5 w-3.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Input
                  value={config.product_focus || ""}
                  onChange={e => setConfig(p => ({ ...p, product_focus: e.target.value }))}
                  placeholder="Nome do produto, preço e link do checkout para a IA fechar a venda de forma rápida."
                  className="text-xs bg-secondary/40 border-border/30 h-9.5"
                />
              </div>

              {/* Base de Documentos RAG (PDF/DOCX) */}
              <div className="space-y-3 pt-3 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Brain className="h-4 w-4 text-primary" /> Base de Documentos RAG (PDF / DOCX / TXT / MD)
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Upload de manuais, transcrições e e-books para o treinamento semântico do Closer AI.</p>
                  </div>
                  <div>
                    <input 
                      ref={importFileRef} 
                      type="file" 
                      multiple 
                      accept=".txt,.md,.pdf,.doc,.docx" 
                      onChange={handleUploadDoc} 
                      className="hidden" 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1 border-primary/20 text-primary hover:bg-primary/5" 
                      onClick={() => importFileRef.current?.click()}
                      disabled={fileUploading}
                    >
                      {fileUploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" /> Enviar Documento
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Docs list */}
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {docsLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground bg-secondary/5 rounded-lg border border-border/30">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Carregando documentos da base...
                    </div>
                  ) : docs.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border/40 rounded-lg bg-secondary/5">
                      <FileText className="h-7 w-7 text-muted-foreground/45 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground italic">Nenhum documento anexado ainda.</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Faça upload de materiais para turbinar as respostas da IA.</p>
                    </div>
                  ) : (
                    docs.map((d) => {
                      const isTrained = d.tags?.includes("ia_treinada") || false;
                      const isProcessing = trainingIds.includes(d.id);
                      const parsed = parseDocContent(d.content);
                      const isFile = parsed.kind === "file";
                      
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/25 border border-border/30 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isFile ? (
                              <FileIcon className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate text-foreground leading-tight">{d.title}</p>
                              {isFile && parsed.mime && (
                                <p className="text-[9px] text-muted-foreground font-mono leading-none mt-0.5 uppercase">
                                  {parsed.mime.split("/")[1]?.replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "docx") || parsed.mime}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 bg-background/50 border border-border/30 px-2 py-0.5 rounded-full">
                              <span className="text-[9px] text-muted-foreground font-medium">Treinamento:</span>
                              <Switch
                                checked={isTrained}
                                disabled={isProcessing}
                                onCheckedChange={() => toggleAiDoc(d)}
                                className="scale-75"
                              />
                              <span className={`text-[9px] font-bold ${isProcessing ? "text-amber-400 animate-pulse" : isTrained ? "text-emerald-400" : "text-muted-foreground"}`}>
                                {isProcessing ? "Processando..." : isTrained ? "Ativado" : "Desativado"}
                              </span>
                            </div>
                            
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-7.5 w-7.5 text-muted-foreground hover:text-foreground hover:bg-secondary" 
                              onClick={() => setViewingDoc(d)} 
                              title="Visualizar"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-7.5 w-7.5 text-destructive hover:bg-destructive/10 shrink-0" 
                              onClick={() => deleteDoc(d.id)} 
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* FAQ Section */}
              <div className="space-y-3 pt-3 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground">FAQ - Respostas Literais para Dúvidas Comuns</Label>
                    <p className="text-[10px] text-muted-foreground">A IA utiliza esse FAQ como fonte prioritária de verdade para dúvidas repetitivas.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-primary/20 text-primary hover:bg-primary/5" onClick={addFaq}>
                    <Plus className="h-3 w-3" /> Adicionar Pergunta
                  </Button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {(config.faq || []).length === 0 && (
                    <div className="text-center py-6 border border-dashed border-border/40 rounded-lg bg-secondary/5">
                      <p className="text-xs text-muted-foreground italic">Nenhuma pergunta cadastrada no FAQ ainda.</p>
                    </div>
                  )}
                  {(config.faq || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-3.5 rounded-lg bg-secondary/25 border border-border/30 shadow-sm animate-fade-in">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            value={item.pergunta}
                            onChange={e => updateFaq(idx, "pergunta", e.target.value)}
                            placeholder={`Pergunta #${idx + 1} (ex: Tem garantia?)`}
                            className="text-xs h-9 bg-background border-border/30 font-medium"
                          />
                          <Textarea
                            value={item.resposta}
                            onChange={e => updateFaq(idx, "resposta", e.target.value)}
                            placeholder="Resposta exata e literal (ex: Sim! Oferecemos 7 dias de garantia incondicional...)"
                            className="min-h-[55px] text-xs bg-background border-border/30 resize-none leading-relaxed"
                          />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 mt-0.5" onClick={() => removeFaq(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ensinar pelo Exemplo Section */}
              <div className="space-y-3 pt-3 border-t border-border/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-indigo-400" /> Ensinar pelo Exemplo
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Cole uma pergunta real de lead e escreva a resposta ideal. A IA vai aprender esse padrão e usá-lo nas próximas conversas.</p>
                </div>
                <div className="space-y-2 p-3.5 rounded-lg bg-secondary/20 border border-border/30">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Pergunta do lead</Label>
                    <Textarea
                      value={exampleQuestion}
                      onChange={e => setExampleQuestion(e.target.value)}
                      placeholder="Ex: Qual a diferença do plano básico pro avançado?"
                      className="min-h-[52px] text-xs bg-background border-border/30 resize-none leading-relaxed"
                      disabled={savingExample}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Resposta ideal da IA</Label>
                    <Textarea
                      value={exampleAnswer}
                      onChange={e => setExampleAnswer(e.target.value)}
                      placeholder="Ex: No plano avançado você tem acesso às mentorias ao vivo, no básico é só o material gravado. A maioria dos alunos escolhe o avançado por isso."
                      className="min-h-[72px] text-xs bg-background border-border/30 resize-none leading-relaxed"
                      disabled={savingExample}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] h-7 px-3 gap-1"
                      onClick={handleSaveExample}
                      disabled={savingExample || !exampleQuestion.trim() || !exampleAnswer.trim()}
                    >
                      {savingExample ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Treinando...</>
                      ) : (
                        <><Brain className="h-3 w-3" /> Treinar IA com este exemplo</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Dúvidas Pendentes Section */}
              <div className="space-y-3 pt-3 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-amber-500 animate-pulse" /> Dúvidas Pendentes de Leads (Filtro de Lacunas)
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Perguntas feitas por leads reais que a IA não soube responder com alta confiança. Responda-as para treinar a IA.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={fetchUnanswered}
                    disabled={unansweredLoading}
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${unansweredLoading ? "animate-spin text-primary" : ""}`} />
                  </Button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {unansweredLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground bg-secondary/5 rounded-lg border border-border/30">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" /> Carregando dúvidas pendentes...
                    </div>
                  ) : unanswered.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border/40 rounded-lg bg-secondary/5">
                      <CheckCircle className="h-7 w-7 text-emerald-500/80 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground italic">Nenhuma dúvida pendente!</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Sua IA está respondendo a tudo com boa confiança ou os leads ainda não mandaram perguntas novas.</p>
                    </div>
                  ) : (
                    unanswered.map((q) => {
                      const isApproving = approvingIds.includes(q.id);
                      return (
                        <div key={q.id} className="p-3.5 rounded-lg bg-secondary/25 border border-border/30 shadow-sm animate-fade-in space-y-2.5">
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-1">
                              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] uppercase tracking-wider font-semibold">
                                Dúvida de Lead
                              </Badge>
                              <p className="text-xs font-semibold text-slate-100 leading-normal">
                                "{q.pergunta}"
                              </p>
                              <p className="text-[9px] text-muted-foreground font-mono">
                                Recebida em: {new Date(q.created_at).toLocaleString("pt-BR")}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => handleDeleteUnanswered(q.id)}
                              title="Descartar dúvida"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="space-y-1.5">
                            <Textarea
                              value={answers[q.id] || ""}
                              onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Digite a resposta correta aqui para que a IA aprenda a responder nas próximas vezes..."
                              className="min-h-[60px] text-xs bg-background border-border/30 resize-none leading-relaxed"
                              disabled={isApproving}
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-7 px-3 gap-1"
                                onClick={() => handleApproveUnanswered(q.id, q.pergunta)}
                                disabled={isApproving}
                              >
                                {isApproving ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" /> Treinando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-3 w-3" /> Aprovar & Treinar IA
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB: APRENDIZADO DA IA ── */}
            <TabsContent value="learned" className="mt-0 animate-fade-in">
              <AILearnedRulesPanel projectId={projectId} />
            </TabsContent>

            {/* ── TAB 5: PLAYGROUND DE TESTE ── */}
            <TabsContent value="playground" className="mt-0 space-y-6 animate-fade-in">
              <div className="bg-primary/5 rounded-lg border border-primary/10 p-4 flex gap-3 items-start">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Playground de Testes de IA</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Escreva cenários reais ou objeções de clientes para testar como o cérebro da IA responderá. Veja em tempo real a postura emocional mapeada, objeções identificadas e a resposta do closer!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Input Scenario */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                      👤 Lead de Teste (Carrega Histórico e Perfil)
                    </Label>
                    <div className="flex gap-2">
                      <Select value={testPhone} onValueChange={setTestPhone}>
                        <SelectTrigger className="bg-secondary/20 border-border/30 text-xs h-9.5 flex-1">
                          <SelectValue placeholder="Selecione um lead de teste" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {leads.map(l => (
                            <SelectItem key={l.id} value={l.phone} className="text-xs">
                              {l.nome || "Lead Sem Nome"} ({l.phone})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        placeholder="Número de teste"
                        className="text-xs bg-secondary/20 border-border/30 h-9.5 w-32 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Mensagem Simulada do Lead</Label>
                    <Textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Ex: 'Seu produto tá muito caro, no concorrente eu vi por metade do preço...'"
                      className="min-h-[140px] text-xs bg-secondary/20 border-border/30 resize-none leading-relaxed p-3.5 focus:border-primary/50"
                    />
                  </div>

                  {/* Suggestion Chips */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Mensagens de Teste Rápidas:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "💰 Tá muito caro", text: "Achei o seu produto muito caro, no concorrente está mais barato, não tem desconto?" },
                        { label: "⏱️ Não tenho tempo", text: "Gostei muito da proposta, mas estou sem tempo agora para focar nisso." },
                        { label: "🤝 Quero comprar!", text: "Perfeito! Gostei muito das condições, como eu faço para realizar o pagamento?" },
                        { label: "🤔 Como funciona?", text: "Pode me explicar detalhadamente como funciona o suporte e qual a garantia?" },
                        { label: "⚡ Preciso urgente", text: "Eu preciso resolver isso hoje mesmo, vocês conseguem me entregar a ferramenta rápido?" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setTestMessage(item.text);
                            toast.info(`Preenchido: "${item.label}"`);
                          }}
                          className="text-[10px] bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-border/60 text-muted-foreground hover:text-foreground px-2 py-1.5 rounded transition-all font-medium"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Test Image URL field */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      📷 URL da Imagem de Teste (opcional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={testImageUrl}
                        onChange={(e) => setTestImageUrl(e.target.value)}
                        placeholder="https://exemplo.com/comprovante-pix.jpg"
                        className="text-xs bg-secondary/20 border-border/30 h-9.5 flex-1"
                      />
                      {testImageUrl && (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-9.5 text-[10px] text-destructive hover:bg-destructive/10" 
                          onClick={() => setTestImageUrl("")}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                    {testImageUrl && (
                      <div className="mt-2 p-1.5 rounded-lg border border-border/30 bg-slate-950/40 w-fit">
                        <img 
                          src={testImageUrl} 
                          className="max-h-[80px] rounded object-contain" 
                          alt="Preview da imagem" 
                          onError={() => {
                            toast.error("URL de imagem inválida ou inacessível");
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="w-full h-10 shadow gap-2 text-xs font-semibold bg-primary hover:bg-primary/95 text-primary-foreground"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Simulando pensamentos da IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Simular Resposta de IA
                      </>
                    )}
                  </Button>
                </div>

                {/* Right: Simulation results */}
                <div className="lg:col-span-7 space-y-4">
                  {simulating ? (
                    <div className="p-6 rounded-xl border border-primary/20 bg-slate-950/80 backdrop-blur-md space-y-6 shadow-inner min-h-[380px] flex flex-col justify-center select-none">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                          <Brain className="h-6 w-6 text-primary absolute left-4 top-4 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-foreground">Cérebro da IA Ativo</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Calculando rota ideal de conversão...</p>
                        </div>
                      </div>

                      {/* Animated Terminal Thought Cascader */}
                      <div className="border border-border/40 bg-slate-900/60 p-4 rounded-xl space-y-3.5 font-mono text-[10px]">
                        <div className="flex items-center justify-between text-muted-foreground/80">
                          <span>PROCESSADOR IMPERIUS v4.2</span>
                          <span className="animate-pulse">● CALIBRANDO</span>
                        </div>
                        <div className="space-y-2 border-t border-border/20 pt-2">
                          <div className="flex items-center gap-2 text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                            <span>[01/04] Analisando sentimento do lead... 🔍</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                            <span>[02/04] Mapeando biblioteca de objeções... ⚠️</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                            <span>[03/04] Ajustando tom de voz dinâmico... 🕯️</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                            <span>[04/04] Redigindo resposta final... 🧠</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : simulationResult ? (
                    <div className="space-y-4 animate-fade-in select-text">
                      {/* Top Visual Indicators for Sentiment and Objection */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Sentimento do Lead</span>
                          <span className="text-sm font-bold text-amber-400">{simulationResult.detectedSentiment || "Cético"}</span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Ajuste de Tom</span>
                          <span className="text-xs text-slate-300 truncate" title={simulationResult.detectedToneExplanation}>{simulationResult.detectedToneExplanation || "Tom direto"}</span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Objeção Detectada</span>
                          <span className={`text-xs font-bold ${simulationResult.matchedObjection ? "text-violet-400" : "text-emerald-400"}`}>
                            {simulationResult.matchedObjection ? "Sim" : "Não"}
                          </span>
                        </div>
                      </div>

                      <Tabs defaultValue="visor" className="w-full mt-2">
                        <TabsList className="bg-background/40 border border-border/30 w-full flex gap-1 mb-4 h-auto p-1">
                          <TabsTrigger value="visor" className="text-xs flex-1 py-1.5">Visualizador</TabsTrigger>
                          <TabsTrigger value="rag" className="text-xs flex-1 py-1.5">RAG / Memórias</TabsTrigger>
                          <TabsTrigger value="prompt" className="text-xs flex-1 py-1.5">Prompt do Sistema</TabsTrigger>
                          <TabsTrigger value="objection" className="text-xs flex-1 py-1.5">Objeção Mapeada</TabsTrigger>
                        </TabsList>

                        {/* ── Sub-Tab 1: Visualizador ── */}
                        <TabsContent value="visor" className="space-y-4 mt-0">
                          {/* Mockup WhatsApp Balloon */}
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground select-none">Mensagem Simulada no WhatsApp</Label>
                            <div className="p-4 rounded-xl bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat min-h-[200px] flex flex-col gap-3 justify-end items-stretch border border-border/30 shadow-inner relative select-none">
                              <div className="absolute top-2 right-2 bg-emerald-500/10 text-emerald-400 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider select-none animate-pulse z-10">
                                Closer Live
                              </div>
                              
                              {/* Balão do Lead (Incoming - Left) */}
                              {(testMessage || testImageUrl) && (
                                <div className="self-start bg-[#202c33] text-[#e9edef] rounded-lg p-2.5 text-xs max-w-[80%] shadow border border-[#233138] select-text">
                                  {testImageUrl && (
                                    <div className="mb-1.5 max-w-full overflow-hidden rounded bg-black/20">
                                      <img src={testImageUrl} className="max-w-full max-h-[140px] object-cover mx-auto" alt="Midia enviada" />
                                    </div>
                                  )}
                                  {testMessage && <div className="whitespace-pre-wrap">{testMessage}</div>}
                                  <div className="text-[8px] text-muted-foreground/60 text-right mt-1 font-sans">
                                    {new Date().toLocaleTimeString().slice(0, 5)}
                                  </div>
                                </div>
                              )}

                              {/* Balão do Closer AI (Outgoing - Right) */}
                              <div className="self-end bg-[#005c4b] text-[#e9edef] rounded-lg p-3 text-xs max-w-[80%] shadow-md leading-relaxed border border-[#025142] select-text">
                                <div className="whitespace-pre-wrap">{simulationResult.replyText}</div>
                                <div className="text-[9px] text-muted-foreground/60 text-right mt-1.5 font-sans leading-none flex items-center justify-end gap-1">
                                  <span>{new Date().toLocaleTimeString().slice(0, 5)}</span>
                                  <span className="text-[#53bdeb] text-[12px]">✓✓</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Utility buttons */}
                          <div className="flex justify-end gap-2 select-none">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 border-border/40 hover:bg-secondary/40"
                              onClick={() => copyToClipboard(simulationResult.replyText)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copiar Resposta
                            </Button>
                          </div>
                        </TabsContent>

                        {/* ── Sub-Tab 2: RAG / Memórias ── */}
                        <TabsContent value="rag" className="space-y-3 mt-0">
                          {simulationResult.vectorMemories && simulationResult.vectorMemories.length > 0 ? (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                              {simulationResult.vectorMemories.map((m: any, idx: number) => (
                                <div key={idx} className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1">
                                      <Brain className="h-3 w-3" />
                                      {m.type === "knowledge" ? "Conhecimento Base" : "Memória do Lead"}
                                    </span>
                                    <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                                      Sim: {(m.similarity * 100).toFixed(1)}%
                                    </Badge>
                                  </div>
                                  <div className="text-xs font-semibold text-foreground">{m.title}</div>
                                  <p className="text-[11px] text-muted-foreground leading-normal whitespace-pre-wrap">{m.content}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center border border-dashed border-border/20 rounded-lg bg-secondary/5">
                              <p className="text-xs text-muted-foreground italic">Nenhuma memória vetorial recuperada para esta mensagem.</p>
                            </div>
                          )}
                        </TabsContent>

                        {/* ── Sub-Tab 3: Prompt do Sistema ── */}
                        <TabsContent value="prompt" className="space-y-3 mt-0">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Prompt do sistema final injetado no LLM:</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] gap-1 hover:bg-secondary"
                                onClick={() => copyToClipboard(simulationResult.systemPrompt)}
                              >
                                <Copy className="h-3 w-3" /> Copiar Prompt
                              </Button>
                            </div>
                            <Textarea
                              readOnly
                              value={simulationResult.systemPrompt || ""}
                              className="h-[260px] font-mono text-[10px] bg-slate-950 text-slate-300 border-border/40 p-3 leading-relaxed focus:ring-0 resize-none"
                            />
                          </div>
                        </TabsContent>

                        {/* ── Sub-Tab 4: Objeção Mapeada ── */}
                        <TabsContent value="objection" className="space-y-3 mt-0">
                          {simulationResult.matchedObjection ? (
                            <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-3">
                              <div className="flex justify-between items-center">
                                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 font-bold text-[10px] uppercase">
                                  Objeção Detectada (Cos Sim &gt;= 0.75)
                                </Badge>
                                <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400 font-mono">
                                  Similaridade: {(simulationResult.matchedObjection.similarity * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-foreground">Objeção Cadastrada:</div>
                                <div className="p-2.5 rounded bg-slate-900 border border-border/40 text-xs italic text-slate-300">
                                  "{simulationResult.matchedObjection.objecao}"
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-emerald-400">Resposta Comercial Calibrada (Mandatória):</div>
                                <div className="p-2.5 rounded bg-slate-900 border border-emerald-500/20 text-xs text-emerald-300 leading-normal">
                                  "{simulationResult.matchedObjection.resposta_padrao}"
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-normal italic">
                                A IA foi instruída a usar prioritariamente essa resposta calibrada para quebrar a objeção, mitigando desvios do roteiro.
                              </p>
                            </div>
                          ) : (
                            <div className="p-6 text-center border border-dashed border-border/20 rounded-lg bg-secondary/5">
                              <p className="text-xs text-muted-foreground italic">Nenhuma objeção cadastrada foi detectada acima do limiar semântico de 0.75.</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-border/40 rounded-lg bg-secondary/5 flex flex-col items-center justify-center text-center space-y-4 min-h-[380px] select-none">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-foreground">Aguardando Mensagem para Simulação</h4>
                        <p className="text-[10px] text-muted-foreground max-w-xs leading-normal">
                          Selecione um lead de teste, escolha um cenário rápido ou digite um texto para rodar a auditoria em tempo real.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

          </div>
        </Tabs>

        {/* Global Save Button at bottom of card */}
        <div className="border-t border-border/30 bg-secondary/10 px-5 py-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-6 h-10 shadow" size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Todas as Configurações
          </Button>
        </div>
      </CardContent>

      <RefineAIDialog open={refineOpen} onOpenChange={setRefineOpen} projectId={projectId} />
      {viewingDoc && (() => {
        const p = parseDocContent(viewingDoc.content);
        return (
          <DocViewerDialog
            open={!!viewingDoc}
            onOpenChange={(v) => !v && setViewingDoc(null)}
            title={viewingDoc.title}
            kind={p.kind}
            url={p.url}
            mime={p.mime}
            content={viewingDoc.content}
          />
        );
      })()}
    </Card>
  );
}
