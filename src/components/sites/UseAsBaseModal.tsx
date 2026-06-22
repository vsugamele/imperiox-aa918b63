import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Sparkles } from "lucide-react";
import type { Site } from "./SiteCard";

export function UseAsBaseModal({
  site, onOpenChange,
}: { site: Site | null; onOpenChange: (v: boolean) => void }) {
  const [projects, setProjects] = useState<{ id: string; nome: string }[]>([]);
  const [projetoId, setProjetoId] = useState<string>("");
  const [modo, setModo] = useState("lp");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    if (!site) return;
    setOutput("");
    supabase.from("imphq_projects").select("id, nome").order("nome").then(({ data }) => {
      setProjects((data || []) as any);
    });
  }, [site]);

  async function handleGenerate() {
    if (!site || !projetoId) return toast.error("Escolha um projeto destino");
    setLoading(true);
    setOutput("");
    const { data, error } = await supabase.functions.invoke("site-clone-to-project", {
      body: { site_id: site.id, projeto_id: projetoId, modo },
    });
    setLoading(false);
    if (error || !data?.success) return toast.error(error?.message || data?.error || "Falha");
    setOutput(data.copy || "");
    toast.success("Copy gerada");
  }

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Usar como base</DialogTitle>
          <DialogDescription className="leading-7">
            Gera nova copy adaptada ao avatar do projeto destino usando "{site?.titulo}" como referência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Projeto destino</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={modo} onValueChange={setModo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lp">Landing Page</SelectItem>
                  <SelectItem value="vsl">VSL (script)</SelectItem>
                  <SelectItem value="email">Email de venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Gerar copy adaptada
          </Button>

          {output && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Resultado</Label>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(output); toast.success("Copiado"); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar
                </Button>
              </div>
              <Textarea value={output} onChange={(e) => setOutput(e.target.value)} className="min-h-[280px] font-mono text-xs leading-6" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
