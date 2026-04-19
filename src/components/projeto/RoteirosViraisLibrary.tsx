import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Search, Sparkles, Copy, Loader2, Wand2, Film, TrendingUp } from "lucide-react";
import { ROTEIROS_TEMPLATES, ROTEIROS_CATEGORIAS, type RoteiroTemplate } from "@/data/roteirosViraisTemplates";

interface Props {
  projectId: string;
  project: any;
}

export function RoteirosViraisLibrary({ projectId, project }: Props) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [selected, setSelected] = useState<RoteiroTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const produtos: any[] = project?.data?.produtos || [];
  const [selectedProduct, setSelectedProduct] = useState(produtos[0]?.nome || produtos[0]?.name || "");

  const filtered = useMemo(() => {
    return ROTEIROS_TEMPLATES.filter((t) => {
      if (filterCat !== "all" && t.categoria !== filterCat) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return t.nome.toLowerCase().includes(q) || t.estrutura.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q);
    });
  }, [search, filterCat]);

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setGenerated("");
    try {
      const productName = selectedProduct || project?.name || "produto";
      const extra = `ESTRUTURA ESCOLHIDA — Template #${selected.id} (${selected.categoria}) — ${selected.nome}\n\nFÓRMULA:\n${selected.estrutura}\n\nPRODUTO ALVO: ${productName}\n${extraInstructions ? `\nINSTRUÇÕES EXTRAS:\n${extraInstructions}` : ""}\n\nMissão: preencha cada [colchete] com conteúdo específico do nicho/avatar. Devolva (1) Roteiro pronto, (2) 3 variações de hook, (3) CTA sugerido, (4) duração estimada em segundos.`;

      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: projectId,
          action: "execute_skill",
          skill_slug: "roteiros-virais-reels",
          extra_instructions: extra,
          model: "google/gemini-3-flash-preview",
        },
      });
      if (error) throw error;
      const content = data?.result || data?.text || data?.content || JSON.stringify(data);
      setGenerated(content);

      // Save to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("imphq_generated_contents").insert({
          project_id: projectId,
          user_id: user.id,
          content_type: "reels_script",
          content,
          product_name: productName,
          model_used: "google/gemini-3-flash-preview",
          metadata: { template_id: selected.id, template_nome: selected.nome, categoria: selected.categoria },
        });
      }
      toast.success("Roteiro gerado e salvo!");
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit. Tente em alguns segundos.");
      else if (err?.message?.includes("402")) toast.error("Créditos insuficientes.");
      else toast.error(err.message || "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Film className="h-4 w-4" /> Biblioteca de Roteiros Virais
            <Badge variant="secondary" className="text-[10px]">{ROTEIROS_TEMPLATES.length} templates</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Estruturas testadas para Reels/TikTok/Shorts. Escolha um template e a IA preenche os [colchetes] com o contexto do projeto.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar template..."
                className="h-8 text-xs bg-secondary"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[200px] h-8 text-xs bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {ROTEIROS_CATEGORIAS.map((c) => (
                  <SelectItem key={c.categoria} value={c.categoria}>{c.icone} {c.categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-[10px]">{filtered.length} resultado(s)</Badge>
          </div>

          {/* Category quick chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCat("all")}
              className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${filterCat === "all" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50"}`}
            >
              Todas
            </button>
            {ROTEIROS_CATEGORIAS.map((c) => (
              <button
                key={c.categoria}
                onClick={() => setFilterCat(c.categoria)}
                className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${filterCat === c.categoria ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50"}`}
                style={filterCat === c.categoria ? { borderColor: c.cor, color: c.cor } : {}}
              >
                {c.icone} {c.categoria}
              </button>
            ))}
          </div>

          <ScrollArea className="h-[600px] pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map((t) => {
                const cat = ROTEIROS_CATEGORIAS.find((c) => c.categoria === t.categoria);
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelected(t); setGenerated(""); }}
                    className="text-left p-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{cat?.icone}</span>
                        <Badge variant="outline" className="text-[8px]" style={{ color: cat?.cor, borderColor: `${cat?.cor}40` }}>
                          #{t.id}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{t.categoria}</span>
                      </div>
                      {t.metricas && (
                        <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <TrendingUp className="h-2.5 w-2.5" />
                          {t.metricas}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold mb-1">{t.nome}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{t.estrutura}</p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail / generation dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">#{selected.id}</Badge>
                  <Badge>{selected.categoria}</Badge>
                  {selected.metricas && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <TrendingUp className="h-3 w-3" /> {selected.metricas}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-primary" /> {selected.nome}
                </DialogTitle>
                <DialogDescription>
                  Configure e gere um roteiro pronto para gravar — a IA preenche os [colchetes] com o avatar e produto do projeto.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Estrutura (fórmula)</Label>
                  <div className="text-xs bg-secondary/50 border border-border rounded-md p-3 leading-relaxed whitespace-pre-wrap">
                    {selected.estrutura}
                  </div>
                </div>

                {selected.exemplos && selected.exemplos.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Exemplos de aplicação</Label>
                    <ul className="space-y-1">
                      {selected.exemplos.map((ex, i) => (
                        <li key={i} className="text-[11px] text-foreground/80 p-2 bg-secondary/30 border border-border rounded">
                          → {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {produtos.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Produto alvo</Label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {produtos.map((p: any, i: number) => (
                            <SelectItem key={i} value={p.nome || p.name}>{p.nome || p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className={produtos.length === 0 ? "sm:col-span-2" : ""}>
                    <Label className="text-xs text-muted-foreground mb-1 block">Instruções extras (opcional)</Label>
                    <Input
                      value={extraInstructions}
                      onChange={(e) => setExtraInstructions(e.target.value)}
                      placeholder="Ex: tom mais informal, foco em mães de pet, mencionar promoção..."
                      className="bg-secondary text-xs"
                    />
                  </div>
                </div>

                <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {generating ? "Gerando roteiro..." : "Gerar roteiro com IA"}
                </Button>

                {generated && (
                  <Card className="bg-secondary/40 border-border">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Sparkles className="h-3 w-3" /> Roteiro pronto
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(generated)} className="h-7 gap-1 text-xs">
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed max-h-[400px] overflow-auto">
                        <ReactMarkdown>{generated}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
