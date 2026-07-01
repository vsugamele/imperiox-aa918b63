import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Site } from "./SiteCard";

export function CreateEcosystemModal({
  site, onOpenChange,
}: { site: Site | null; onOpenChange: (v: boolean) => void }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [destino, setDestino] = useState<string>("__new__");
  const [novoNome, setNovoNome] = useState("");
  const [nicho, setNicho] = useState("");
  const [tom, setTom] = useState("consultivo premium");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!site) return;
    setResult(null);
    setNovoNome(site.titulo);
    setNicho(site.tags?.join(", ") || "");
    supabase.from("imphq_projects").select("id, name").order("name").then(({ data }) => {
      setProjects((data || []) as any);
    });
  }, [site]);

  async function handleGenerate() {
    if (!site) return;
    if (destino === "__new__" && !novoNome.trim()) return toast.error("Informe o nome do novo projeto");

    setLoading(true);
    setResult(null);
    const body: any = { site_id: site.id, nicho, tom };
    if (destino === "__new__") body.novo_projeto_nome = novoNome.trim();
    else body.projeto_id = destino;

    const { data, error } = await supabase.functions.invoke("site-to-ecosystem", { body });
    setLoading(false);
    if (error || !data?.success) {
      return toast.error(error?.message || data?.error || "Falha ao gerar ecossistema");
    }
    setResult(data);
    toast.success("Ecossistema gerado!");
  }

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-serif">
            <Sparkles className="h-5 w-5 text-primary" /> Criar Ecossistema
          </DialogTitle>
          <DialogDescription className="leading-7">
            A IA usa "{site?.titulo}" como referência e gera projeto + avatar + 4 produtos (principal, order bump, upsell, low ticket) + VSL + 10 criativos + LP + funil completo.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Projeto destino</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">➕ Criar novo projeto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {destino === "__new__" && (
              <div className="space-y-2">
                <Label>Nome do novo projeto</Label>
                <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nicho / Tema</Label>
                <Input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex: emagrecimento feminino" />
              </div>
              <div className="space-y-2">
                <Label>Tom / Voz</Label>
                <Input value={tom} onChange={(e) => setTom(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground leading-6 space-y-1">
              <p>Será gerado:</p>
              <p>• Avatar (dores, desejos, objeções, linguagem)</p>
              <p>• 4 produtos com promessa, mecanismo, preço, bullets</p>
              <p>• Roteiro VSL (7 blocos)</p>
              <p>• 6 criativos imagem + 4 roteiros vídeo</p>
              <p>• Estrutura da LP</p>
              <p>• Funil organizado no canvas (/funis)</p>
            </div>

            <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Gerando ecossistema (45-90s)…" : "⚡ Gerar Ecossistema Completo"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> <span className="font-semibold">Pronto!</span>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm space-y-1 leading-7">
              <p>👤 Avatar: <strong>{result.avatar_nome}</strong></p>
              <p>📦 {result.produtos_criados} produtos criados</p>
              <p>🎬 VSL roteiro salvo no Swipe</p>
              <p>🎨 {result.criativos_ids?.length || 0} criativos prontos</p>
              {result.funil_id && <p>🔀 Funil montado no canvas</p>}
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/projeto/${result.projeto_id}`} onClick={() => onOpenChange(false)}>Abrir Projeto</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link to="/funis" onClick={() => onOpenChange(false)}>Abrir Funil</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
