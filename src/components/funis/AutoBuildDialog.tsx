import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Package, Workflow, MessageSquare, Mail, Globe, Megaphone, FormInput } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId?: string;
  funilId: string;
  onApplied: (etapas: any[]) => void;
}

export function AutoBuildDialog({ open, onOpenChange, projectId, funilId, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [detected, setDetected] = useState<any>(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (open && projectId) {
      setLoading(true);
      supabase.functions
        .invoke("funnel-autobuild", { body: { project_id: projectId, mode: "detect" } })
        .then(({ data, error }) => {
          if (error) toast.error(error.message);
          else {
            setDetected(data?.detected || null);
            setProjectName(data?.project_name || "");
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, projectId]);

  const apply = async () => {
    if (!projectId) return;
    setApplying(true);
    const { data, error } = await supabase.functions.invoke("funnel-autobuild", {
      body: { project_id: projectId, funil_id: funilId, mode: "apply" },
    });
    setApplying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onApplied(data?.etapas || []);
    toast.success(`Funil montado com ${data?.etapas?.length || 0} etapas`);
    onOpenChange(false);
  };

  const items = [
    { key: "produtos", label: "Produtos do briefing", icon: Package },
    { key: "sites", label: "Páginas / Sites", icon: Globe },
    { key: "ads_campaigns", label: "Campanhas de anúncios", icon: Megaphone },
    { key: "capture_forms", label: "Formulários de captura", icon: FormInput },
    { key: "flows", label: "Fluxos OpenFlow", icon: Workflow },
    { key: "wa_campaigns", label: "Campanhas WhatsApp", icon: MessageSquare },
    { key: "email_sequences", label: "Sequências de e-mail", icon: Mail },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-primary" /> Montar Funil Automático
          </DialogTitle>
          <DialogDescription className="leading-7">
            {projectId
              ? <>Vou ler tudo que já existe vinculado a <span className="text-primary font-medium">{projectName || "este projeto"}</span> e organizar no canvas. O estado atual será salvo em Versões.</>
              : "Selecione um projeto no editor antes de usar."}
          </DialogDescription>
        </DialogHeader>

        {!projectId ? null : loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Detectando ativos…
          </div>
        ) : detected ? (
          <div className="space-y-2">
            {items.map(({ key, label, icon: Icon }) => {
              const n = detected[key] || 0;
              return (
                <div key={key} className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="leading-7">{label}</span>
                  </div>
                  <Badge variant={n > 0 ? "default" : "secondary"} className="text-[10px]">
                    {n} {n === 1 ? "item" : "itens"}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={apply} disabled={!projectId || loading || applying} className="gap-2">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Montar e substituir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
