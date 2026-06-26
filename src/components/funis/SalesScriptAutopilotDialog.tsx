import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, X, Sparkles, Shield, Zap, Image as ImageIcon, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  produtoNome?: string;
  produtoId?: string;
  onCreated: (id: string) => void;
}

interface Provider { id: string; name: string; instance_name?: string }

export function SalesScriptAutopilotDialog({ open, onClose, projectId, produtoNome, produtoId, onCreated }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [tom, setTom] = useState("Sugamele, consultivo, pt-BR");
  const [pitchLink, setPitchLink] = useState("");
  const [keywords, setKeywords] = useState<string[]>(["quero", "preço", "info", "como funciona"]);
  const [keywordInput, setKeywordInput] = useState("");
  const [breakthrough, setBreakthrough] = useState(true);
  const [credibility, setCredibility] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    supabase.from("imphq_wa_providers").select("id, name, instance_name").eq("active", true).then(({ data }) => {
      setProviders((data as any[]) || []);
    });
  }, [open]);

  const addKw = () => {
    const v = keywordInput.trim().toLowerCase();
    if (v && !keywords.includes(v)) setKeywords([...keywords, v]);
    setKeywordInput("");
  };
  const removeKw = (k: string) => setKeywords(keywords.filter(x => x !== k));

  const handleRun = async () => {
    setLoading(true);
    setProgress("Gerando blueprint base...");
    try {
      const { data, error } = await supabase.functions.invoke("sales-script-autopilot", {
        body: {
          project_id: projectId,
          produto_nome: produtoNome,
          produto_id: produtoId,
          tom,
          apply_breakthrough: breakthrough,
          apply_credibility: credibility,
          provider_id: providerId || null,
          keywords,
          pitch_link: pitchLink || null,
        },
      });
      if (error) throw error;
      if (data?.blueprint_id) {
        toast.success(`Script pronto! ${data.skill_count} skills aplicadas · ${data.image_jobs} imagens em fila`);
        onCreated(data.blueprint_id);
        onClose();
      } else {
        toast.error(data?.error || "Falha na geração");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onClose}>
      <DialogContent className="bg-secondary/40 border-border/60 max-w-xl leading-7">
        <DialogHeader>
          <DialogTitle className="text-amber-300 flex items-center gap-2">
            <Bot className="h-5 w-5" /> Script de Venda Completo
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Gera blueprint X1 + aplica 7 Manobras de Schwartz + Blinda Provas (Bencivenga) + Imagens + Atrela WhatsApp.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Tom de voz</Label>
            <Input value={tom} onChange={(e) => setTom(e.target.value)} className="h-8 text-xs mt-1" />
          </div>

          <div>
            <Label className="text-xs">Chip WhatsApp (provider)</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {providers.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name} {p.instance_name ? `(${p.instance_name})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Link de checkout / pitch</Label>
            <Input value={pitchLink} onChange={(e) => setPitchLink(e.target.value)} placeholder="https://..." className="h-8 text-xs mt-1" />
          </div>

          <div>
            <Label className="text-xs">Palavras-chave de ativação</Label>
            <div className="flex gap-1 mt-1">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
                placeholder="ex: quero, preço, link..."
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addKw} className="h-8 text-xs">+</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {keywords.map(k => (
                <Badge key={k} variant="outline" className="text-[10px] gap-1">
                  {k}
                  <button onClick={() => removeKw(k)}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/40 p-3 bg-background/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-400" /> Aplicar 7 Manobras (Schwartz)</Label>
              <Switch checked={breakthrough} onCheckedChange={setBreakthrough} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-sky-400" /> Blindar Provas (Bencivenga)</Label>
              <Switch checked={credibility} onCheckedChange={setCredibility} />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <Label className="text-xs flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Gerar imagens (automático)</Label>
              <span className="text-[10px]">via flow-image-worker</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <Label className="text-xs flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5" /> Criar trigger WhatsApp</Label>
              <span className="text-[10px]">{keywords.length} keyword(s)</span>
            </div>
          </div>

          {loading && (
            <div className="text-xs text-amber-300 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress || "Processando..."} (pode levar 30–60s)
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleRun} disabled={loading} className="gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar Script Completo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
