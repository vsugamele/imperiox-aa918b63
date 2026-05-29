import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Database, Plus, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  projectId?: string;
  produto?: string;
  onDone: () => void;
}

export default function CampaignAIGenerateDialog({ open, onClose, campaignId, projectId, produto, onDone }: Props) {
  const [count, setCount] = useState(7);
  const [tom, setTom] = useState("vendas");
  const [briefing, setBriefing] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  // Novos campos de Briefing Avançado e Contexto do Projeto para maior assertividade
  const [includeAvatar, setIncludeAvatar] = useState(true);
  const [includeExpert, setIncludeExpert] = useState(true);
  const [includeProduct, setIncludeProduct] = useState(true);
  const [mainTheme, setMainTheme] = useState("");
  const [offerDetail, setOfferDetail] = useState("");
  const [showAdvancedBriefing, setShowAdvancedBriefing] = useState(false);

  const generate = async () => {
    setLoading(true);

    // Compila o briefing avançado de forma altamente estruturada
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
      // Limpa os estados locais após sucesso
      setMainTheme("");
      setOfferDetail("");
      setBriefing("");
      setReference("");
      setShowAdvancedBriefing(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar sequência");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold animate-pulse" /> Gerar sequência de mensagens com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Inputs de Qtd e Tom */}
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

          {/* Dados do Projeto para Carregar */}
          {projectId && (
            <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/20 space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-border/20 pb-1.5">
                <Database className="h-4 w-4 text-primary" />
                <Label className="text-xs font-bold text-foreground">Puxar dados inteligentes do projeto</Label>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Marque quais pilares de inteligência do projeto você deseja incorporar nesta geração para máxima precisão de copy:
              </p>
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

          {/* Alinhamento Avançado (Perguntas Extras) */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedBriefing(!showAdvancedBriefing)}
              className="w-full text-xs h-8.5 border-dashed flex items-center justify-center gap-1.5 hover:bg-secondary/40"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              {showAdvancedBriefing ? "Recolher Briefing Avançado" : "Perguntas de Alinhamento Avançado (Mais assertividade)"}
              {showAdvancedBriefing ? <ChevronUp className="h-3.5 w-3.5 ml-auto text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
            </Button>

            {showAdvancedBriefing && (
              <div className="space-y-3 p-3.5 rounded-lg border border-primary/10 bg-primary/5 animate-slide-in">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">🎯 Qual o gancho ou tema central da sequência?</Label>
                  <Input
                    value={mainTheme}
                    onChange={(e) => setMainTheme(e.target.value)}
                    placeholder="Ex: Entregar aula prática e depois abrir vagas com bônus..."
                    className="h-8 text-xs bg-background border-border/30"
                  />
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    Foca a narrativa em torno de uma linha de assunto ou conceito central.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">💰 Qual a oferta final, bônus ou prazo de escassez?</Label>
                  <Input
                    value={offerDetail}
                    onChange={(e) => setOfferDetail(e.target.value)}
                    placeholder="Ex: R$ 4.997 com R$ 1.000 de desconto + Mentoria Individual até sexta..."
                    className="h-8 text-xs bg-background border-border/30"
                  />
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    Garante que a IA insira os números de conversão e elementos de urgência reais no final.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Briefing Textarea */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Instruções extras (opcional)</Label>
            <Textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Ex: Adicione bônus surpresa no Dia 4, use mais analogias de futebol, CTA no dia 7 para checkout..."
              rows={3}
              className="text-xs bg-secondary/30 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Puxará o produto ({produto || "Geral do Projeto"}) e as diretrizes básicas do projeto automaticamente.
            </p>
          </div>

          {/* Reference Textarea */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Referência de Copy (opcional)</Label>
            <Textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cole 1-2 mensagens de exemplo que você gosta para a IA imitar o estilo e ritmo..."
              rows={3}
              className="text-xs bg-secondary/30 resize-none leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border/30 pt-3 mt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={generate} disabled={loading} className="gap-1.5 shadow">
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</> : <><Sparkles className="h-3.5 w-3.5" /> Gerar {count} mensagens</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
