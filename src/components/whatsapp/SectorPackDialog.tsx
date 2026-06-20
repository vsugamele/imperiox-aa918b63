import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Check } from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

interface Template {
  id: string;
  setor: string;
  nome: string;
  emoji: string | null;
  descricao: string | null;
  config_json: any;
  faq_json: any[];
  ordem: number;
}

export default function SectorPackDialog({ projectId, open, onOpenChange, onApplied }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("imphq_wa_sector_templates" as any)
      .select("*")
      .order("ordem")
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          toast.error("Erro ao carregar pacotes de setor");
        } else {
          setTemplates((data as any) || []);
        }
        setLoading(false);
      });
  }, [open]);

  const applyPack = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      const cfg = selected.config_json || {};
      const { error } = await supabase
        .from("imphq_wa_ai_config")
        .upsert({
          project_id: projectId,
          personality: cfg.personality || "assistente",
          tone: cfg.tone || "profissional",
          welcome_message: cfg.welcome_message || "",
          custom_instructions: cfg.custom_instructions || "",
          escalation_keywords: cfg.escalation_keywords || [],
          banned_phrases: cfg.banned_phrases || [],
          closer_mode_enabled: !!cfg.closer_mode_enabled,
          voice_reply_enabled: !!cfg.voice_reply_enabled,
          business_hours_only: !!cfg.business_hours_only,
          faq: selected.faq_json || [],
          enabled: true,
          sector_template_applied: selected.setor,
        }, { onConflict: "project_id" });
      if (error) throw error;
      toast.success(`📦 Pack "${selected.nome}" aplicado!`, { description: "Personalize os campos restantes conforme seu negócio." });
      onOpenChange(false);
      setSelected(null);
      onApplied?.();
    } catch (err: any) {
      toast.error("Erro ao aplicar pack", { description: err.message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!applying) { onOpenChange(o); if (!o) setSelected(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Setup pack por setor
          </DialogTitle>
          <DialogDescription>
            Escolha o setor mais próximo do seu negócio e aplique uma configuração pronta de IA com persona, FAQ e regras.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            {templates.map((t) => {
              const isSel = selected?.id === t.id;
              return (
                <Card
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`p-4 cursor-pointer transition-all border-2 ${isSel ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/30"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-2xl">{t.emoji || "📦"}</div>
                    {isSel && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="font-semibold leading-tight">{t.nome}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{t.descricao}</div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {t.config_json?.personality && (
                      <Badge variant="outline" className="text-[10px]">{t.config_json.personality}</Badge>
                    )}
                    {t.config_json?.closer_mode_enabled && (
                      <Badge variant="outline" className="text-[10px]">closer</Badge>
                    )}
                    {Array.isArray(t.faq_json) && t.faq_json.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">{t.faq_json.length} FAQ</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="bg-muted/30 rounded-md p-3 mt-2 text-xs space-y-1">
            <div className="font-semibold mb-1">Prévia:</div>
            <div><span className="text-muted-foreground">Saudação:</span> "{selected.config_json?.welcome_message}"</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={applying}>Cancelar</Button>
          <Button onClick={applyPack} disabled={!selected || applying}>
            {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando...</> : <>Aplicar pack</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
