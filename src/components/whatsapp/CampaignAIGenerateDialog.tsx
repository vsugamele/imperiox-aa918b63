import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Database, Plus, CheckCircle, ChevronDown, ChevronUp, Wand2, PencilRuler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CampaignAIDiffDialog from "./CampaignAIDiffDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  projectId?: string;
  produto?: string;
  onDone: () => void;
}

type Mode = "create" | "adjust";

export default function CampaignAIGenerateDialog({ open, onClose, campaignId, projectId, produto, onDone }: Props) {
  const [mode, setMode] = useState<Mode>("create");

  // create
  const [count, setCount] = useState(7);
  const [tom, setTom] = useState("vendas");
  const [briefing, setBriefing] = useState("");
  const [reference, setReference] = useState("");
  const [includeAvatar, setIncludeAvatar] = useState(true);
  const [includeExpert, setIncludeExpert] = useState(true);
  const [includeProduct, setIncludeProduct] = useState(true);
  const [mainTheme, setMainTheme] = useState("");
  const [offerDetail, setOfferDetail] = useState("");
  const [showAdvancedBriefing, setShowAdvancedBriefing] = useState(false);

  // adjust
  const [adjustRequest, setAdjustRequest] = useState("");
  const [adjustScope, setAdjustScope] = useState<"all" | "active">("all");
  const [allowTiming, setAllowTiming] = useState(true);

  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<any[] | null>(null);

  const handleGenerateCreate = async () => {
    setLoading(true);
    const structuredBriefing = [
      `[ESPECIFICAÇÕES DA SEQUÊNCIA]`,
      `- Tom de voz desejado: ${tom}`,
      `- Foco do Produto: ${produto || "Geral do Projeto"}`,
      ``,
      `[DADOS DO PROJETO INTEGRADOS]`,
      includeAvatar ? `- IMPORTANTE: Extraia e utilize ativamente as Dores, Desejos, Problemas e Perfil Psicológico do Avatar cadastrados no projeto para gerar conexão.` : "- Não carregar contexto de avatar.",
      includeExpert ? `- IMPORTANTE: Incorpore a Persona, Bio, Tom de voz e pilares do Expert do projeto para manter a autoridade.` : "- Não carregar contexto de expert.",
      includeProduct ? `- IMPORTANTE: Utilize a Promessa, Mecanismo Único e links de checkout dos Produtos cadastrados no projeto para acelerar as vendas.` : "- Não carregar contexto de produtos.",
      ``,
      `[PERGUNTAS DE ALINHAMENTO / ALVO]`,
      mainTheme.trim() ? `- Gancho/Tema Central da Sequência: ${mainTheme.trim()}` : "",
      offerDetail.trim() ? `- Detalhes da Oferta/Bônus/Escassez: ${offerDetail.trim()}` : "",
      briefing.trim() ? `- Briefing Adicional do Usuário: ${briefing.trim()}` : "",
    ].filter(Boolean).join("\n");

    try {
      const { data, error } = await supabase.functions.invoke("wa-campaign-ai-generate", {
        body: {
          mode: "create",
          campaign_id: campaignId,
          project_id: projectId,
          produto,
          count,
          tom,
          briefing: structuredBriefing,
          reference,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`✨ ${data?.inserted || 0} mensagens geradas e adicionadas`);
      onDone();
      onClose();
      setMainTheme(""); setOfferDetail(""); setBriefing(""); setReference(""); setShowAdvancedBriefing(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar sequência");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAdjust = async () => {
    if (!adjustRequest.trim()) {
      toast.error("Descreva o ajuste que você quer fazer");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-campaign-ai-generate", {
        body: {
          mode: "adjust",
          campaign_id: campaignId,
          project_id: projectId,
          produto,
          tom,
          briefing,
          adjust_request: adjustRequest,
          adjust_scope: adjustScope,
          allow_timing: allowTiming,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const d = Array.isArray(data?.diff) ? data.diff : [];
      if (d.length === 0) {
        toast.warning("IA não retornou propostas de ajuste");
        return;
      }
      setDiff(d);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar ajuste");
    } finally {
      setLoading(false);
    }
  };

  const handleDiffApplied = () => {
    setDiff(null);
    setAdjustRequest("");
    onDone();
    onClose();
  };

  return (
    <>
      <Dialog open={open && !diff} onOpenChange={(o) => !o && !loading && onClose()}>
        <DialogContent className="bg-secondary/40 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold animate-pulse" />
              {mode === "create" ? "Gerar sequência de mensagens com IA" : "Ajustar sequência existente com IA"}
            </DialogTitle>
          </DialogHeader>

          {/* Toggle de modo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-background/40 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition ${mode === "create" ? "bg-primary/20 text-primary border border-primary/40" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Wand2 className="h-3.5 w-3.5" /> Criar nova
            </button>
            <button
              type="button"
              onClick={() => setMode("adjust")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition ${mode === "adjust" ? "bg-primary/20 text-primary border border-primary/40" : "text-muted-foreground hover:text-foreground"}`}
            >
              <PencilRuler className="h-3.5 w-3.5" /> Ajustar existente
            </button>
          </div>

          {mode === "adjust" ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-foreground">📝 O que você quer ajustar?</Label>
                <Textarea
                  value={adjustRequest}
                  onChange={(e) => setAdjustRequest(e.target.value)}
                  placeholder="Ex: O webinar foi remarcado de 01/06 para 22/06, mesmo horário (20h). Recalcule todas as datas, contagem regressiva e referências temporais para a nova data."
                  rows={4}
                  className="text-xs bg-secondary/30 resize-none leading-relaxed mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1 leading-5">
                  A IA vai ler todas as mensagens da sequência e propor uma versão ajustada. Você revisa antes de aplicar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Escopo</Label>
                  <Select value={adjustScope} onValueChange={(v: any) => setAdjustScope(v)}>
                    <SelectTrigger className="h-9 text-xs bg-secondary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Toda a sequência</SelectItem>
                      <SelectItem value="active" className="text-xs">Só mensagens ativas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Tom de Voz</Label>
                  <Select value={tom} onValueChange={setTom}>
                    <SelectTrigger className="h-9 text-xs bg-secondary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendas" className="text-xs">🔥 Venda direta</SelectItem>
                      <SelectItem value="conteudo" className="text-xs">📚 Conteúdo de valor</SelectItem>
                      <SelectItem value="aquecimento" className="text-xs">☀️ Aquecimento</SelectItem>
                      <SelectItem value="lancamento" className="text-xs">🚀 Lançamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs cursor-pointer p-2.5 rounded-lg border border-border/30 bg-secondary/20">
                <Checkbox checked={allowTiming} onCheckedChange={(v) => setAllowTiming(!!v)} className="mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Permitir alterar dia (offset) e horário</div>
                  <div className="text-[10px] text-muted-foreground leading-5">Necessário se a data do evento mudou. Desligue para que a IA só reescreva o texto.</div>
                </div>
              </label>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Instruções extras (opcional)</Label>
                <Textarea
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder="Ex: Mantenha as analogias de futebol, não remova emojis..."
                  rows={2}
                  className="text-xs bg-secondary/30 resize-none leading-relaxed mt-1"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Qtd. de mensagens</Label>
                  <Input type="number" min={1} max={60} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 7)} className="h-9 text-xs bg-secondary/30" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Tom de Voz</Label>
                  <Select value={tom} onValueChange={setTom}>
                    <SelectTrigger className="h-9 text-xs bg-secondary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendas" className="text-xs">🔥 Venda direta</SelectItem>
                      <SelectItem value="conteudo" className="text-xs">📚 Conteúdo de valor</SelectItem>
                      <SelectItem value="aquecimento" className="text-xs">☀️ Aquecimento de Leads</SelectItem>
                      <SelectItem value="lancamento" className="text-xs">🚀 Lançamento oficial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {projectId && (
                <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/20 space-y-2.5">
                  <div className="flex items-center gap-1.5 border-b border-border/20 pb-1.5">
                    <Database className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-bold text-foreground">Puxar dados inteligentes do projeto</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1.5">
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer hover:text-foreground transition-colors">
                      <Checkbox checked={includeAvatar} onCheckedChange={(v) => setIncludeAvatar(!!v)} />
                      <span className="text-muted-foreground font-medium">Perfil do Avatar</span>
                    </label>
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer hover:text-foreground transition-colors">
                      <Checkbox checked={includeExpert} onCheckedChange={(v) => setIncludeExpert(!!v)} />
                      <span className="text-muted-foreground font-medium">Expert & Tom</span>
                    </label>
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer hover:text-foreground transition-colors">
                      <Checkbox checked={includeProduct} onCheckedChange={(v) => setIncludeProduct(!!v)} />
                      <span className="text-muted-foreground font-medium">Dados do Produto</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedBriefing(!showAdvancedBriefing)}
                  className="w-full text-xs h-8.5 border-dashed flex items-center justify-center gap-1.5 hover:bg-secondary/40"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  {showAdvancedBriefing ? "Recolher Briefing Avançado" : "Perguntas de Alinhamento Avançado"}
                  {showAdvancedBriefing ? <ChevronUp className="h-3.5 w-3.5 ml-auto text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
                </Button>

                {showAdvancedBriefing && (
                  <div className="space-y-3 p-3.5 rounded-lg border border-primary/10 bg-primary/5 animate-slide-in">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">🎯 Gancho ou tema central?</Label>
                      <Input value={mainTheme} onChange={(e) => setMainTheme(e.target.value)} placeholder="Ex: Aula prática e abertura de vagas com bônus..." className="h-8 text-xs bg-background border-border/30" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">💰 Oferta final / bônus / escassez?</Label>
                      <Input value={offerDetail} onChange={(e) => setOfferDetail(e.target.value)} placeholder="Ex: R$ 4.997 + Mentoria Individual até sexta..." className="h-8 text-xs bg-background border-border/30" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Instruções extras (opcional)</Label>
                <Textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} placeholder="Ex: Adicione bônus surpresa no Dia 4, CTA no dia 7..." rows={3} className="text-xs bg-secondary/30 resize-none leading-relaxed" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Puxará o produto ({produto || "Geral do Projeto"}) e as diretrizes do projeto automaticamente.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Referência de Copy (opcional)</Label>
                <Textarea value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cole 1-2 mensagens de exemplo..." rows={3} className="text-xs bg-secondary/30 resize-none leading-relaxed" />
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border/30 pt-3 mt-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={mode === "adjust" ? handleGenerateAdjust : handleGenerateCreate} disabled={loading} className="gap-1.5 shadow">
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {mode === "adjust" ? "Analisando..." : "Gerando..."}</>
              ) : mode === "adjust" ? (
                <><Sparkles className="h-3.5 w-3.5" /> Propor ajustes</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Gerar {count} mensagens</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {diff && (
        <CampaignAIDiffDialog
          open={!!diff}
          onClose={() => setDiff(null)}
          campaignId={campaignId}
          diff={diff as any}
          onApplied={handleDiffApplied}
        />
      )}
    </>
  );
}
