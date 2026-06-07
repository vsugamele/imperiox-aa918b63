import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Split, GitFork, Play, Square, Loader2, Trash2, ArrowRight,
  TrendingUp, BarChart3, AlertCircle, CheckCircle2, FlaskConical, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ABTest {
  id: string;
  project_id: string;
  name: string;
  trigger_stage: string;
  active: boolean;
  winner_variant_id: string | null;
  min_sample_size: number;
  created_at: string;
}

interface ABVariant {
  id: string;
  test_id: string;
  name: string;
  message_template: string;
  sent_count: number;
  reply_count: number;
  conversion_count: number;
  traffic_percentage: number;
  active: boolean;
}

export default function ABTests() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => localStorage.getItem("ab.selectedProject") || "");
  const [tests, setTests] = useState<ABTest[]>([]);
  const [variants, setVariants] = useState<Record<string, ABVariant[]>>({});
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [testForm, setTestForm] = useState({
    name: "",
    trigger_stage: "frio",
    min_sample_size: 100,
    variantA_name: "Variante A (Controle)",
    variantA_copy: "",
    variantA_traffic: 50,
    variantB_name: "Variante B (Desafiante)",
    variantB_copy: "",
    variantB_traffic: 50,
  });

  const loadProjects = async () => {
    const { data } = await supabase.from("imphq_projects").select("id, name");
    setProjects(data || []);
    if (data && data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data[0].id);
      localStorage.setItem("ab.selectedProject", data[0].id);
    }
  };

  const loadTests = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const { data: testsData, error: testsErr } = await supabase
        .from("imphq_wa_ab_tests")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false });

      if (testsErr) throw testsErr;
      setTests(testsData || []);

      if (testsData && testsData.length > 0) {
        const testIds = testsData.map(t => t.id);
        const { data: varsData, error: varsErr } = await supabase
          .from("imphq_wa_ab_test_variants")
          .select("*")
          .in("test_id", testIds);

        if (varsErr) throw varsErr;

        const grouped: Record<string, ABVariant[]> = {};
        (varsData || []).forEach((v) => {
          if (!grouped[v.test_id]) grouped[v.test_id] = [];
          grouped[v.test_id].push(v as ABVariant);
        });
        setVariants(grouped);
      } else {
        setVariants({});
      }
    } catch (err: any) {
      console.error("Erro ao carregar testes A/B:", err.message);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadTests();
    }
  }, [selectedProjectId]);

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    localStorage.setItem("ab.selectedProject", id);
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    if (!testForm.name.trim() || !testForm.variantA_copy.trim() || !testForm.variantB_copy.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      // 1. Criar o teste
      const { data: testData, error: testErr } = await supabase
        .from("imphq_wa_ab_tests")
        .insert({
          project_id: selectedProjectId,
          name: testForm.name,
          trigger_stage: testForm.trigger_stage,
          min_sample_size: testForm.min_sample_size,
          active: true
        })
        .select()
        .single();

      if (testErr) throw testErr;

      // 2. Criar as variantes
      const { error: varsErr } = await supabase
        .from("imphq_wa_ab_test_variants")
        .insert([
          {
            test_id: testData.id,
            name: testForm.variantA_name,
            message_template: testForm.variantA_copy,
            traffic_percentage: testForm.variantA_traffic,
            active: true
          },
          {
            test_id: testData.id,
            name: testForm.variantB_name,
            message_template: testForm.variantB_copy,
            traffic_percentage: testForm.variantB_traffic,
            active: true
          }
        ]);

      if (varsErr) throw varsErr;

      toast.success("Teste A/B criado com sucesso!");
      setShowCreateDialog(false);
      setTestForm({
        name: "",
        trigger_stage: "frio",
        min_sample_size: 100,
        variantA_name: "Variante A (Controle)",
        variantA_copy: "",
        variantA_traffic: 50,
        variantB_name: "Variante B (Desafiante)",
        variantB_copy: "",
        variantB_traffic: 50,
      });
      loadTests();
    } catch (err: any) {
      toast.error("Erro ao criar teste: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTest = async (test: ABTest) => {
    try {
      const { error } = await supabase
        .from("imphq_wa_ab_tests")
        .update({ active: !test.active })
        .eq("id", test.id);

      if (error) throw error;
      toast.success(test.active ? "Teste pausado." : "Teste ativado.");
      loadTests();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!confirm("Excluir este teste A/B permanentemente? Todos os logs de conversão serão apagados.")) return;
    try {
      const { error } = await supabase
        .from("imphq_wa_ab_tests")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Teste A/B excluído.");
      loadTests();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const runEvaluation = async () => {
    toast.info("Executando avaliação estatística via Edge Function...");
    try {
      const { data, error } = await supabase.functions.invoke("wa-ab-test-evaluator");
      if (error) throw error;
      if (data?.evaluated) {
        toast.success(`Avaliação concluída! ${data.evaluated} testes processados. ${data.winners_promoted} vencedores promovidos.`);
        loadTests();
      } else {
        toast.success("Avaliação concluída. Nenhum teste com amostra estatística suficiente para promoção.");
      }
    } catch (err: any) {
      toast.error("Erro na avaliação: " + err.message);
    }
  };

  // Cálculo de significância (Chi-Square)
  const getStats = (varA?: ABVariant, varB?: ABVariant) => {
    if (!varA || !varB) return { chiSquare: 0, pValue: 1, significant: false };
    const a_sent = varA.sent_count || 0;
    const a_conv = varA.conversion_count || 0;
    const b_sent = varB.sent_count || 0;
    const b_conv = varB.conversion_count || 0;

    const a_rate = a_sent > 0 ? (a_conv / a_sent) * 100 : 0;
    const b_rate = b_sent > 0 ? (b_conv / b_sent) * 100 : 0;

    const a_no_conv = a_sent - a_conv;
    const b_no_conv = b_sent - b_conv;
    const total_sent = a_sent + b_sent;

    if (total_sent === 0 || a_sent === 0 || b_sent === 0) {
      return { chiSquare: 0, pValue: 1, significant: false, a_rate, b_rate };
    }

    const total_conv = a_conv + b_conv;
    const total_no_conv = a_no_conv + b_no_conv;

    const exp_a_conv = (a_sent * total_conv) / total_sent;
    const exp_a_no_conv = (a_sent * total_no_conv) / total_sent;
    const exp_b_conv = (b_sent * total_conv) / total_sent;
    const exp_b_no_conv = (b_sent * total_no_conv) / total_sent;

    if (exp_a_conv === 0 || exp_a_no_conv === 0 || exp_b_conv === 0 || exp_b_no_conv === 0) {
      return { chiSquare: 0, pValue: 1, significant: false, a_rate, b_rate };
    }

    const chiSquare =
      Math.pow(a_conv - exp_a_conv, 2) / exp_a_conv +
      Math.pow(a_no_conv - exp_a_no_conv, 2) / exp_a_no_conv +
      Math.pow(b_conv - exp_b_conv, 2) / exp_b_conv +
      Math.pow(b_no_conv - exp_b_no_conv, 2) / exp_b_no_conv;

    const significant = chiSquare >= 3.841; // df=1, p < 0.05
    const pValue = Math.min(1, Math.exp(-chiSquare / 2));

    return { chiSquare, pValue, significant, a_rate, b_rate };
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Split className="h-6 w-6 text-primary" />
            Testes A/B de Copy (WhatsApp)
          </h2>
          <p className="text-xs text-muted-foreground">
            Crie variações de copys, avalie a significância estatística das conversões e promova as melhores copies automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="h-9 px-3 rounded-md bg-secondary/50 border border-border/60 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                📂 {p.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={runEvaluation}
            className="border-primary/40 text-primary hover:bg-primary/10 text-xs h-9"
          >
            <FlaskConical className="h-3.5 w-3.5 mr-1" />
            Rodar Avaliação (Chi²)
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary text-black hover:bg-primary/90 text-xs h-9 font-semibold"
          >
            + Criar Teste A/B
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tests.length === 0 ? (
        <Card className="bg-card border-border/60">
          <CardContent className="p-12 text-center space-y-3">
            <GitFork className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-bold text-foreground">Nenhum Teste A/B Configurado</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Testes A/B dividem os leads que entram em um estágio de funil (ex: Frio, Morno) para receberem copies diferentes. Clique em "Criar Teste A/B" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {tests.map((test) => {
            const vars = variants[test.id] || [];
            const varA = vars[0];
            const varB = vars[1];
            const stats = getStats(varA, varB);
            const totalSent = (varA?.sent_count || 0) + (varB?.sent_count || 0);
            const winner = test.winner_variant_id ? vars.find(v => v.id === test.winner_variant_id) : null;

            return (
              <Card key={test.id} className="bg-card border-border/60 shadow-lg relative overflow-hidden">
                {winner && (
                  <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 border-l border-b border-emerald-500/35 px-3 py-1 text-[10px] font-bold uppercase rounded-bl-lg flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Vencedora Definida: {winner.name}
                  </div>
                )}
                <CardHeader className="p-4 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-900 border border-border/50 text-[10px] font-mono capitalize">
                        Estágio: {test.trigger_stage}
                      </Badge>
                      <Badge variant={test.active ? "default" : "outline"} className={test.active ? "bg-amber-500 text-black hover:bg-amber-500" : ""}>
                        {test.active ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {test.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Tamanho mínimo da amostra: {test.min_sample_size} leads por variante · Total enviado: {totalSent}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleTest(test)}
                      className={cn("text-xs h-8 px-2.5", test.active ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10")}
                    >
                      {test.active ? <Square className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                      {test.active ? "Pausar" : "Ativar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTest(test.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Variantes visualizer */}
                  <div className="lg:col-span-2 space-y-4">
                    {vars.map((v) => {
                      const rate = v.sent_count > 0 ? (v.conversion_count / v.sent_count) * 100 : 0;
                      const isWinner = test.winner_variant_id === v.id;
                      return (
                        <div key={v.id} className={cn("p-4 rounded-xl border border-border/30 bg-secondary/15 space-y-3 relative transition-all", isWinner && "border-emerald-500/30 bg-emerald-500/5")}>
                          <div className="flex justify-between items-center flex-wrap gap-2 text-xs">
                            <h4 className="font-bold text-foreground flex items-center gap-1.5">
                              <GitFork className="h-4 w-4 text-primary" />
                              {v.name}
                              <span className="text-[10px] text-muted-foreground font-normal">({v.traffic_percentage}% do tráfego)</span>
                            </h4>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-slate-950 border border-border/40 font-mono text-[10px]">
                                taxa: {rate.toFixed(1)}%
                              </Badge>
                              {isWinner && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] uppercase font-bold">
                                  Vencedora
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-950/45 p-3 rounded-lg border border-border/20 text-xs italic font-sans text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
                            "{v.message_template}"
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-[10px] text-muted-foreground pt-1.5 border-t border-border/10">
                            <div>
                              Enviados: <strong className="text-foreground">{v.sent_count || 0}</strong>
                            </div>
                            <div>
                              Respostas: <strong className="text-foreground">{v.reply_count || 0}</strong>
                            </div>
                            <div>
                              Conversões: <strong className="text-foreground text-emerald-400">{v.conversion_count || 0}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Estatísticas e Significância */}
                  <div className="bg-secondary/15 p-4 rounded-xl border border-border/30 flex flex-col justify-between space-y-4">
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5 text-primary" />
                        Análise de Significância
                      </h4>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Chi-Square (X²)</span>
                          <span className="font-mono text-foreground font-bold">{stats.chiSquare.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>p-valor</span>
                          <span className="font-mono text-foreground font-bold">{stats.pValue.toFixed(4)}</span>
                        </div>
                      </div>

                      <div className="EDITORIAL-DIVIDER h-px bg-border/20" />

                      {totalSent < test.min_sample_size * 2 ? (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg flex gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-[10px] text-amber-400 leading-normal">
                            <strong>Amostra Insuficiente:</strong> Faltam {test.min_sample_size * 2 - totalSent} envios combinados para atingir o tamanho mínimo de amostra.
                          </div>
                        </div>
                      ) : stats.significant ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg flex gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="text-[10px] text-emerald-300 leading-normal">
                            <strong>Significativo (p &lt; 0.05):</strong> A diferença de conversão é estatisticamente válida. O sistema irá promover a melhor copy.
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900 border border-border/30 p-3 rounded-lg flex gap-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="text-[10px] text-muted-foreground leading-normal">
                            <strong>Sem Significância:</strong> A diferença observada até agora pode ser devido ao acaso. Continue coletando dados.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Variante A</span>
                        <span className="font-mono text-foreground">{stats.a_rate?.toFixed(1)}% conv</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Variante B</span>
                        <span className="font-mono text-foreground">{stats.b_rate?.toFixed(1)}% conv</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-foreground border-t border-border/10 pt-1.5">
                        <span>Diferença Relativa</span>
                        <span className={cn(stats.b_rate >= stats.a_rate ? "text-emerald-400" : "text-destructive")}>
                          {(stats.b_rate - stats.a_rate).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Criar Teste A/B */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-1.5">
              <Split className="h-5 w-5 text-primary" />
              Criar Novo Teste A/B de Copy
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure uma campanha de teste A/B para testar duas variações de copies em um estágio específico do funil.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTest} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Nome da Campanha A/B</Label>
                <Input
                  id="name"
                  value={testForm.name}
                  onChange={(e) => setTestForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Recuperação de Pix Quente V1"
                  className="bg-secondary/40 border-border/50 text-sm focus-visible:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="trigger_stage" className="text-xs">Estágio de Funil Disparador</Label>
                <select
                  id="trigger_stage"
                  value={testForm.trigger_stage}
                  onChange={(e) => setTestForm(prev => ({ ...prev, trigger_stage: e.target.value }))}
                  className="w-full h-10 px-2 rounded-md bg-secondary/40 border border-border/50 text-sm focus-visible:ring-primary focus-visible:outline-none"
                >
                  <option value="frio">Frio</option>
                  <option value="morno">Morno</option>
                  <option value="quente">Quente</option>
                  <option value="cliente">Cliente</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min_sample_size" className="text-xs">Tamanho de Amostra Mínimo (leads por variante)</Label>
              <Input
                id="min_sample_size"
                type="number"
                value={testForm.min_sample_size}
                onChange={(e) => setTestForm(prev => ({ ...prev, min_sample_size: Number(e.target.value) }))}
                placeholder="Ex: 100"
                className="bg-secondary/40 border-border/50 text-sm focus-visible:ring-primary"
                required
              />
            </div>

            <div className="EDITORIAL-DIVIDER h-px bg-border/20 my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variante A */}
              <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-secondary/10">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                  <GitFork className="h-3.5 w-3.5" />
                  Variante A (Controle)
                </h4>
                <div className="space-y-1.5">
                  <Label htmlFor="variantA_name" className="text-[10px]">Nome da Variante</Label>
                  <Input
                    id="variantA_name"
                    value={testForm.variantA_name}
                    onChange={(e) => setTestForm(prev => ({ ...prev, variantA_name: e.target.value }))}
                    className="bg-secondary/40 border-border/50 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="variantA_copy" className="text-[10px]">Texto da Mensagem / Copy</Label>
                  <textarea
                    id="variantA_copy"
                    value={testForm.variantA_copy}
                    onChange={(e) => setTestForm(prev => ({ ...prev, variantA_copy: e.target.value }))}
                    placeholder="Oi, tudo bem? Notei que você..."
                    className="w-full h-36 p-2 rounded-md bg-secondary/40 border border-border/50 text-xs focus-visible:ring-primary focus-visible:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Variante B */}
              <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-secondary/10">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                  <GitFork className="h-3.5 w-3.5" />
                  Variante B (Desafiante)
                </h4>
                <div className="space-y-1.5">
                  <Label htmlFor="variantB_name" className="text-[10px]">Nome da Variante</Label>
                  <Input
                    id="variantB_name"
                    value={testForm.variantB_name}
                    onChange={(e) => setTestForm(prev => ({ ...prev, variantB_name: e.target.value }))}
                    className="bg-secondary/40 border-border/50 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="variantB_copy" className="text-[10px]">Texto da Mensagem / Copy</Label>
                  <textarea
                    id="variantB_copy"
                    value={testForm.variantB_copy}
                    onChange={(e) => setTestForm(prev => ({ ...prev, variantB_copy: e.target.value }))}
                    placeholder="Epa! Passando aqui rápido para..."
                    className="w-full h-36 p-2 rounded-md bg-secondary/40 border border-border/50 text-xs focus-visible:ring-primary focus-visible:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateDialog(false)}
                disabled={saving}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary text-black hover:bg-primary/95 text-xs font-semibold gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Criando..." : "Criar Campanha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
