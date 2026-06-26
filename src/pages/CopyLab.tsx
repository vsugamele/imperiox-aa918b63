import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Copy as CopyIcon, Sparkles, MessageSquare, Stethoscope, Film, Zap, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Project = { id: string; name: string };
type Intent =
  | "vsl_imperador"
  | "criativo_imperador"
  | "conversa_imperador"
  | "diagnostico_imperador"
  | "vsl_filemon_e3"
  | "breakthrough_techniques"
  | "weaponized_credibility";

const TABS: Array<{ id: Intent; label: string; icon: any; subtitle: string }> = [
  { id: "vsl_imperador", label: "VSL Reversa", icon: Film, subtitle: "Engenharia reversa: mecanismo → provas → abertura" },
  { id: "criativo_imperador", label: "Criativo", icon: Sparkles, subtitle: "5 variações com mecanismo nomeado" },
  { id: "conversa_imperador", label: "Conversa WA", icon: MessageSquare, subtitle: "Sequência em cadeia de sins" },
  { id: "diagnostico_imperador", label: "Diagnóstico", icon: Stethoscope, subtitle: "Laudo nas 11 leis" },
  { id: "vsl_filemon_e3", label: "VSL Filemon E3", icon: Film, subtitle: "Pipeline 6 blocos: Raio-X → Mecanismo → Tese → História → Lead → Oferta" },
  { id: "breakthrough_techniques", label: "Breakthrough", icon: Zap, subtitle: "Aplica as 7 manobras de Schwartz sobre copy existente" },
  { id: "weaponized_credibility", label: "Credibilidade", icon: Shield, subtitle: "Blinda copy com prova (Bencivenga) — mata ceticismo sem baixar o claim" },
];

export default function CopyLab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("__none__");
  const [activeTab, setActiveTab] = useState<Intent>("vsl_imperador");

  const [briefing, setBriefing] = useState("");
  const [crenca, setCrenca] = useState("");
  const [referencia, setReferencia] = useState("");
  const [copyParaDiagnostico, setCopyParaDiagnostico] = useState("");

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name")
        .order("name");
      setProjects((data as Project[]) || []);
    })();
  }, []);

  const needsExistingCopy = (id: Intent) =>
    id === "diagnostico_imperador" || id === "breakthrough_techniques" || id === "weaponized_credibility";

  const runGeneration = async () => {
    if (needsExistingCopy(activeTab) && !copyParaDiagnostico.trim()) {
      toast.error("Cole uma copy/claim para o motor trabalhar.");
      return;
    }
    if (!needsExistingCopy(activeTab) && !briefing.trim() && projectId === "__none__") {
      toast.error("Preencha o briefing ou selecione um projeto.");
      return;
    }

    setLoading(true);
    setOutput("");

    const inputParts: string[] = [];
    if (needsExistingCopy(activeTab)) {
      const label = activeTab === "weaponized_credibility" ? "COPY/CLAIM A BLINDAR" : activeTab === "breakthrough_techniques" ? "COPY A POTENCIALIZAR" : "COPY A DIAGNOSTICAR";
      inputParts.push(`## ${label}\n` + copyParaDiagnostico);
      if (briefing.trim()) inputParts.push("## CONTEXTO ADICIONAL\n" + briefing);
    } else {
      if (briefing.trim()) inputParts.push("## BRIEFING\n" + briefing);
      if (crenca.trim()) inputParts.push("## CRENÇA-ÂNCORA MANUAL\n" + crenca);
      if (referencia.trim()) inputParts.push("## REFERÊNCIA DE CONCORRENTE\n" + referencia);
    }

    const { data, error } = await supabase.functions.invoke("copy-engine", {
      body: {
        intent: activeTab,
        input: inputParts.join("\n\n") || "Gere usando o contexto do projeto.",
        context: projectId !== "__none__" ? { project_id: projectId } : undefined,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message || "Erro ao gerar.");
      return;
    }
    if (data?.error) {
      toast.error(typeof data.error === "string" ? data.error : "Erro do motor.");
      return;
    }
    setOutput(data?.content || "(sem conteúdo)");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copiado.");
  };

  const current = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-serif text-3xl md:text-4xl">Copy Lab — Imperador</h1>
            <p className="text-sm text-muted-foreground">As 11 leis aplicadas como motor de copy estratégico.</p>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Projeto (contexto: avatar, branding, produto)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Sem contexto de projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem projeto —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Badge variant="outline" className="text-[10px]">
                Motor: copy-engine · Doutrina: 11 leis (McKee/Halbert/Hopkins/Rage/Brunson/Mark Ford)
              </Badge>
            </div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Intent); setOutput(""); }}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 w-full">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <t.icon className="h-4 w-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground italic">{t.subtitle}</p>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  {t.id === "diagnostico_imperador" ? (
                    <div>
                      <Label>Copy a diagnosticar</Label>
                      <Textarea
                        rows={14}
                        placeholder="Cole aqui a VSL, anúncio, página ou mensagem que quer auditar..."
                        value={copyParaDiagnostico}
                        onChange={(e) => setCopyParaDiagnostico(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Briefing livre</Label>
                        <Textarea
                          rows={5}
                          placeholder="Contexto, objetivo, ângulo, oferta..."
                          value={briefing}
                          onChange={(e) => setBriefing(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Crença-âncora (opcional)</Label>
                        <Input
                          placeholder="Ex: 'emagrecer exige sofrimento'"
                          value={crenca}
                          onChange={(e) => setCrenca(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Referência de concorrente (URL ou transcrição)</Label>
                        <Textarea
                          rows={4}
                          placeholder="Cole transcrição de VSL/anúncio para engenharia reversa..."
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <Button onClick={runGeneration} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crown className="h-4 w-4 mr-2" />}
                    {loading ? "Gerando..." : `Invocar Imperador — ${current.label}`}
                  </Button>
                </Card>

                <Card className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Saída</Label>
                    {output && (
                      <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                        <CopyIcon className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                    )}
                  </div>
                  <div className="min-h-[420px] max-h-[70vh] overflow-y-auto prose prose-sm prose-invert max-w-none bg-secondary/40 rounded p-4 leading-7">
                    {output ? (
                      <ReactMarkdown>{output}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        A saída do Imperador aparece aqui após a invocação.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
