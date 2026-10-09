import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy, Crown, Loader2, PenLine, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/error-message";
import { FORMATOS, buildModelingInput, buildReferenceDossier, hasDissection, type FormatoRoteiro, type RefForBrief } from "@/lib/reference-brief";

export type CriarRoteiroRef = RefForBrief & { id: string; project_id?: string | null; produto?: string | null };

type Project = { id: string; name: string };
const OUTRO = "__outro__";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();

/** Gera um roteiro modelado numa referência dissecada para o produto escolhido (copy-engine · modelar_referencia). */
export function CriarRoteiroModal({ item, open, onOpenChange }: { item: CriarRoteiroRef | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(OUTRO);
  const [produtoLivre, setProdutoLivre] = useState("");
  const [formato, setFormato] = useState<FormatoRoteiro>("comment_dm");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || projects.length) return;
    supabase.from("imphq_projects").select("id, name").order("name").then(({ data }) => setProjects((data as Project[]) || []));
  }, [open, projects.length]);

  // Ao abrir outra referência: limpa a saída e sugere o projeto dela (ou o que bate com o campo produto).
  useEffect(() => {
    if (!open || !item) return;
    setOutput("");
    setExtra("");
    const byId = item.project_id && projects.find((p) => p.id === item.project_id);
    const byName = item.produto && projects.find((p) => norm(p.name) === norm(item.produto!));
    const match = byId || byName;
    setProjectId(match ? match.id : OUTRO);
    setProdutoLivre(match ? "" : item.produto ?? "");
  }, [open, item, projects]);

  const produto = projectId === OUTRO ? produtoLivre.trim() : projects.find((p) => p.id === projectId)?.name ?? "";
  const input = useMemo(() => (item ? buildModelingInput(item, formato, produto || "[produto]", extra) : ""), [item, formato, produto, extra]);

  if (!item) return null;
  const dissecada = hasDissection(item);

  const gerar = async () => {
    if (!produto) { toast.error("Escolha ou digite o produto."); return; }
    setLoading(true);
    setOutput("");
    try {
      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: "modelar_referencia",
          input,
          context: UUID.test(projectId) ? { project_id: projectId } : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro do motor");
      setOutput(data?.content || "(sem conteúdo)");
    } catch (e: unknown) {
      toast.error("Não consegui gerar o roteiro", { description: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  const copiar = async (text: string, msg: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(msg);
    setTimeout(() => setCopied(false), 2000);
  };

  const abrirCopyLab = () => {
    onOpenChange(false);
    navigate("/copy-lab", {
      state: { initialIntent: "criativo_imperador", projectId: UUID.test(projectId) ? projectId : undefined, briefing: input, initialOutput: output },
    });
  };

  const abrirUgc = () => {
    onOpenChange(false);
    navigate("/ugc", {
      state: { produto, research: `ROTEIRO MODELADO (base)\n${output}\n\nREFERÊNCIA\n${buildReferenceDossier(item).slice(0, 4000)}` },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-amber-400" /> Criar roteiro baseado nesta referência
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{item.titulo}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {!dissecada && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Esta referência ainda não foi dissecada. O roteiro sai mais fraco: só com título e transcrição, se houver.
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Produto de destino</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  <SelectItem value={OUTRO}>Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
              {projectId === OUTRO && (
                <Input className="h-9 text-sm" value={produtoLivre} onChange={(e) => setProdutoLivre(e.target.value)} placeholder="Nome e o que o produto faz" />
              )}
              {UUID.test(projectId) && <p className="text-[11px] text-muted-foreground">Usa avatar, produto e guardrails do projeto.</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v as FormatoRoteiro)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea rows={2} className="text-sm" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex.: público 45+, focar no inchaço das pernas, palavra do CTA = PERNAS" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={gerar} disabled={loading} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Gerando roteiro… (até 1 min)" : output ? "Gerar de novo" : "Gerar roteiro"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => copiar(input, "Briefing copiado (para usar no ChatGPT/Claude)")} className="gap-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" /> Copiar briefing
            </Button>
            {item.analise?.anatomy?.blocks?.length ? (
              <Badge variant="outline" className="text-[10px]">{item.analise.anatomy.blocks.length} blocos · {item.analise.cenas?.length ?? 0} cenas</Badge>
            ) : null}
          </div>

          {output && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => copiar(output, "Roteiro copiado")} className="gap-1.5 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar roteiro
                </Button>
                <Button size="sm" variant="outline" onClick={abrirCopyLab} className="gap-1.5 text-xs">
                  <Crown className="h-3.5 w-3.5" /> Refinar no Copy Lab
                </Button>
                {formato === "ugc" && (
                  <Button size="sm" variant="outline" onClick={abrirUgc} className="gap-1.5 text-xs">
                    <Video className="h-3.5 w-3.5" /> Mandar pro UGC Factory
                  </Button>
                )}
              </div>
              <div className="prose prose-sm prose-invert max-w-none rounded-lg border border-border bg-secondary/40 p-4 leading-7 [&_table]:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
