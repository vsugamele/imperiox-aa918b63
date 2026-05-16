import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Share2, Copy, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  produto?: string;
}

export default function CampaignShareDialog({ open, onClose, campaignId, campaignName, produto }: Props) {
  const [name, setName] = useState(campaignName);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(campaignName);
    setResultSlug(null);
    (async () => {
      const { data } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("step_order, content, content_b, media_type, send_time, days_offset, is_active")
        .eq("campaign_id", campaignId)
        .order("step_order");
      setSteps(data || []);
    })();
  }, [open, campaignId, campaignName]);

  const genSlug = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const publish = async () => {
    if (steps.length === 0) { toast.error("Sequência vazia"); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login");
      const slug = genSlug();
      const { error } = await supabase.from("imphq_wa_campaign_templates").insert({
        slug,
        name,
        description: description || null,
        produto: produto || null,
        author_id: user.id,
        steps: steps as any,
        is_public: isPublic,
      } as any);
      if (error) throw error;
      setResultSlug(slug);
      toast.success("Template publicado!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify({ name, produto, steps }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name.replace(/[^\w]+/g, "-")}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const shareUrl = resultSlug ? `${window.location.origin}/whatsapp?import=${resultSlug}` : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Share2 className="h-4 w-4 text-gold" /> Compartilhar sequência
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-6">
            {steps.length} mensagens nesta sequência. Publique um template para outros importarem por link, ou baixe um JSON.
          </p>
          <div>
            <Label className="text-xs">Nome do template</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} id="pub" />
            <Label htmlFor="pub" className="text-xs cursor-pointer">Público (qualquer pessoa pode importar)</Label>
          </div>

          {resultSlug && (
            <div className="rounded border border-gold/30 bg-gold/5 p-3 space-y-2">
              <p className="text-[11px] text-gold">✓ Template publicado. Compartilhe o link:</p>
              <div className="flex items-center gap-1.5">
                <Input value={shareUrl} readOnly className="h-8 text-xs font-mono" />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copiado!"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">slug: {resultSlug}</p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={downloadJSON} className="w-full sm:w-auto">
            <Download className="h-3.5 w-3.5 mr-1" /> Baixar JSON
          </Button>
          <Button onClick={publish} disabled={loading || !!resultSlug} className="w-full sm:w-auto">
            {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Publicando...</> : <><Share2 className="h-3.5 w-3.5 mr-1" /> Publicar template</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
