import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Sparkles, Loader2, User, ListChecks, BookOpen, MessagesSquare, FolderOpen, Trash2, Plus, Volume2 } from "lucide-react";
import { toast } from "sonner";

interface AgentRow {
  id: string;
  nome: string;
  avatar_url: string | null;
  project_id: string | null;
  ativo: boolean;
  identidade: string;
  diretrizes: string;
  objetivo: string;
  instrucoes_atendimento: string;
  restricoes: string;
  base_conhecimento: string;
  voice_config: { voice: string; stability: number; similarity: number; style: number; speed: number };
  qa_pairs: { q: string; a: string }[];
  files: { name: string; url: string }[];
}

const VOICES = ["Samuel", "Laila", "João", "Maria", "Carlos", "Ana"];

export default function AgenteEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [aRes, pRes] = await Promise.all([
        supabase.from("imphq_ai_agents" as any).select("*").eq("id", id).maybeSingle(),
        supabase.from("imphq_projects").select("id, name").order("name"),
      ]);
      if (aRes.data) setAgent(aRes.data as any);
      setProjects((pRes.data as any[]) || []);
    })();
  }, [id]);

  const save = async () => {
    if (!agent) return;
    setSaving(true);
    const { error } = await supabase.from("imphq_ai_agents" as any).update({
      nome: agent.nome, avatar_url: agent.avatar_url, project_id: agent.project_id, ativo: agent.ativo,
      identidade: agent.identidade, diretrizes: agent.diretrizes, objetivo: agent.objetivo,
      instrucoes_atendimento: agent.instrucoes_atendimento, restricoes: agent.restricoes,
      base_conhecimento: agent.base_conhecimento, voice_config: agent.voice_config,
      qa_pairs: agent.qa_pairs, files: agent.files,
    } as any).eq("id", agent.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Agente salvo");
  };

  const autofill = async () => {
    if (!agent) return;
    setAutofilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-autofill", {
        body: { project_id: agent.project_id, nome: agent.nome },
      });
      if (error) throw error;
      if (data?.ok) {
        setAgent({
          ...agent,
          identidade: data.identidade || agent.identidade,
          diretrizes: data.diretrizes || agent.diretrizes,
          objetivo: data.objetivo || agent.objetivo,
          instrucoes_atendimento: data.instrucoes_atendimento || agent.instrucoes_atendimento,
          restricoes: data.restricoes || agent.restricoes,
        });
        toast.success("Preenchimento gerado — revise e salve");
      } else throw new Error(data?.error || "Falha");
    } catch (e: any) {
      toast.error(e?.message || "Erro no autofill");
    } finally {
      setAutofilling(false);
    }
  };

  if (!agent) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const upd = <K extends keyof AgentRow>(k: K, v: AgentRow[K]) => setAgent({ ...agent, [k]: v });
  const updVoice = (k: keyof AgentRow["voice_config"], v: any) => setAgent({ ...agent, voice_config: { ...agent.voice_config, [k]: v } });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-white/5 bg-secondary/30">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/openflow/agentes")} className="h-9 w-9 bg-secondary/60 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-100">Agente — {agent.nome}</h1>
              <p className="text-xs text-muted-foreground">Gerencie as configurações do agente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={autofill} disabled={autofilling} className="border-primary/40 text-primary hover:bg-primary/10">
              {autofilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Preenchimento automático
            </Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-6">
        <Tabs defaultValue="personalidade" className="w-full">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto bg-transparent border-b border-white/5 rounded-none p-0">
            <TabsTrigger value="personalidade" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none py-3">
              <User className="h-4 w-4" /> Personalidade
            </TabsTrigger>
            <TabsTrigger value="instrucoes" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none py-3">
              <ListChecks className="h-4 w-4" /> Instruções
            </TabsTrigger>
            <TabsTrigger value="base" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none py-3">
              <BookOpen className="h-4 w-4" /> Base de Informações
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none py-3">
              <MessagesSquare className="h-4 w-4" /> Perguntas e Respostas
            </TabsTrigger>
            <TabsTrigger value="arquivos" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none py-3">
              <FolderOpen className="h-4 w-4" /> Arquivos
            </TabsTrigger>
          </TabsList>

          {/* PERSONALIDADE */}
          <TabsContent value="personalidade" className="space-y-8 pt-8">
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold">Identidade</h3>
              <Textarea
                value={agent.identidade}
                onChange={e => upd("identidade", e.target.value)}
                placeholder="Ex.: Seu nome é Imperius, você é o assistente virtual da empresa. Você é estratégico, direto e sempre demonstra domínio técnico nas interações."
                className="min-h-[110px] bg-secondary/40 border-white/10 leading-7"
              />
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold">Diretrizes de Comunicação</h3>
              <Textarea
                value={agent.diretrizes}
                onChange={e => upd("diretrizes", e.target.value)}
                placeholder={"Defina como o agente deve se expressar (tom de voz, clareza, formalidade, uso de emojis).\nExemplo 1: 'Comunique-se de forma clara, objetiva e educada. Use linguagem formal e evite gírias. Não utilize emojis.'\nExemplo 2: 'Use uma linguagem leve, simpática e acolhedora. Utilize emojis apenas para reforçar simpatia, sem exagerar.'"}
                className="min-h-[140px] bg-secondary/40 border-white/10 leading-7"
              />
            </section>

            <section className="space-y-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" /> Voz
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Voz</Label>
                  <Select value={agent.voice_config.voice} onValueChange={v => updVoice("voice", v)}>
                    <SelectTrigger className="bg-secondary/40 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{VOICES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10">
                    <Volume2 className="h-4 w-4 mr-2" /> Testar Voz
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
                {([
                  { k: "stability", label: "Estabilidade", range: "0.0 - 1.0", help: "Consistência entre gerações", min: 0, max: 1, step: 0.05 },
                  { k: "similarity", label: "Similaridade", range: "0.0 - 1.0", help: "Fidelidade à voz original", min: 0, max: 1, step: 0.05 },
                  { k: "style", label: "Sotaque", range: "0.0 - 1.0", help: "Estilo e expressividade", min: 0, max: 1, step: 0.05 },
                  { k: "speed", label: "Velocidade", range: "0.7 - 1.2", help: "Velocidade de fala", min: 0.7, max: 1.2, step: 0.05 },
                ] as Array<{ k: keyof AgentRow["voice_config"]; label: string; range: string; help: string; min: number; max: number; step: number }>).map(({ k, label, range, help, min, max, step }) => (
                  <div key={k} className="space-y-2">
                    <div>
                      <Label className="text-sm font-semibold">{label} <span className="text-[10px] text-muted-foreground font-normal">({range})</span></Label>
                    </div>
                    <Slider
                      value={[(agent.voice_config as any)[k]]}
                      min={min} max={max} step={step}
                      onValueChange={v => updVoice(k, v[0])}
                    />
                    <p className="text-[10px] text-muted-foreground leading-4">{help}</p>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* INSTRUÇÕES */}
          <TabsContent value="instrucoes" className="space-y-8 pt-8">
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold">Objetivo</h3>
              <Textarea
                value={agent.objetivo}
                onChange={e => upd("objetivo", e.target.value)}
                placeholder='Defina a principal função do agente. Ex.: "Qualificar leads e agendar reuniões." "Atender clientes com dúvidas sobre produtos e enviar ofertas."'
                className="min-h-[80px] bg-secondary/40 border-white/10 leading-7"
              />
            </section>
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold">Instruções de Atendimento</h3>
              <Textarea
                value={agent.instrucoes_atendimento}
                onChange={e => upd("instrucoes_atendimento", e.target.value)}
                placeholder={"Cumprimente o cliente pelo nome e se apresente de forma simpática.\nIdentifique o que ele busca, nível de urgência, orçamento e quem decide a compra.\nApresente a solução com benefícios claros e prova social.\nTrate objeções comuns (preço, prazo, risco) oferecendo condições, garantias ou bônus.\nFeche a venda confirmando a escolha e enviando link de pagamento."}
                className="min-h-[180px] bg-secondary/40 border-white/10 leading-7"
              />
            </section>
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold">Restrições</h3>
              <Textarea
                value={agent.restricoes}
                onChange={e => upd("restricoes", e.target.value)}
                placeholder={"Não envie informações de pagamento antes do cliente confirmar a compra.\nNão cite concorrentes nem assuntos fora do contexto da empresa.\nNão ofereça descontos ou condições que não estejam na tabela oficial."}
                className="min-h-[130px] bg-secondary/40 border-white/10 leading-7"
              />
            </section>
          </TabsContent>

          {/* BASE DE INFORMAÇÕES */}
          <TabsContent value="base" className="space-y-4 pt-8">
            <h3 className="font-display text-lg font-semibold">Conhecimento Base do Agente</h3>
            <Textarea
              value={agent.base_conhecimento}
              onChange={e => upd("base_conhecimento", e.target.value)}
              placeholder={"Inclua dados essenciais que o agente deve conhecer:\nDescrição dos principais produtos e serviços.\nPreços, planos, formas de pagamento e condições comerciais.\nPolíticas de entrega, troca, devolução e garantias.\nHorários de funcionamento, canais e contatos oficiais.\nDiferenciais, cases e provas de confiança.\nProcedimentos internos (etapas de compra, suporte, pós-venda)."}
              className="min-h-[320px] bg-secondary/40 border-white/10 leading-7"
            />
          </TabsContent>

          {/* Q&A */}
          <TabsContent value="qa" className="space-y-4 pt-8">
            <div className="flex justify-between items-center">
              <h3 className="font-display text-lg font-semibold">Perguntas e Respostas</h3>
              <Button
                variant="outline"
                onClick={() => upd("qa_pairs", [...(agent.qa_pairs || []), { q: "", a: "" }])}
                className="border-primary/40 text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar par
              </Button>
            </div>
            {(agent.qa_pairs || []).length === 0 && (
              <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-white/10 rounded-xl">
                Adicione pares Q&A para respostas determinísticas antes do LLM entrar em cena.
              </p>
            )}
            <div className="space-y-3">
              {(agent.qa_pairs || []).map((qa, i) => (
                <div key={i} className="bg-secondary/40 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">Par #{i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-400" onClick={() => {
                      const arr = [...agent.qa_pairs]; arr.splice(i, 1); upd("qa_pairs", arr);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Pergunta (ou palavra-chave)"
                    value={qa.q}
                    onChange={e => { const arr = [...agent.qa_pairs]; arr[i] = { ...arr[i], q: e.target.value }; upd("qa_pairs", arr); }}
                    className="bg-background/60 border-white/10"
                  />
                  <Textarea
                    placeholder="Resposta exata que o agente deve enviar"
                    value={qa.a}
                    onChange={e => { const arr = [...agent.qa_pairs]; arr[i] = { ...arr[i], a: e.target.value }; upd("qa_pairs", arr); }}
                    className="min-h-[80px] bg-background/60 border-white/10 leading-7"
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ARQUIVOS */}
          <TabsContent value="arquivos" className="space-y-4 pt-8">
            <ArquivosTab agentId={agent.id} files={agent.files || []} onChange={(f) => upd("files", f)} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
