import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/error-message";
import { planPlaybook, type Playbook } from "@shared/playbooks";
import { findProjectMap } from "@shared/playbook-apply";
import { useApplyPlaybook, useMapContext, useProjectsAndMaps } from "@/hooks/usePlaybooks";

interface ApplyPlaybookDialogProps {
  playbook: Playbook | null;
  onOpenChange: (open: boolean) => void;
}

export function ApplyPlaybookDialog({ playbook, onOpenChange }: ApplyPlaybookDialogProps) {
  const navigate = useNavigate();
  const { data: targets } = useProjectsAndMaps();
  const apply = useApplyPlaybook();
  const [projectId, setProjectId] = useState<string>("");
  const [mapId, setMapId] = useState<string>("");
  const [produto, setProduto] = useState("");
  const [plataforma, setPlataforma] = useState("Instagram");
  const [conta, setConta] = useState("");
  const { data: mapCtx, isLoading: loadingMap } = useMapContext(mapId || null);

  const project = targets?.projects.find((p) => p.id === projectId) ?? null;
  const isOrganic = playbook?.familia === "organico";
  const params = useMemo(() => {
    const raw: Record<string, string> = { projeto: project?.name ?? "", produto: produto || project?.name || "", ...(isOrganic ? { plataforma, conta } : {}) };
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v.trim() !== ""));
  }, [project, produto, isOrganic, plataforma, conta]);

  const plan = useMemo(() => (playbook && mapCtx ? planPlaybook(playbook, mapCtx, params) : null), [playbook, mapCtx, params]);
  const labelOf = useMemo(() => new Map((mapCtx?.nodes ?? []).map((n) => [n.id, n.label])), [mapCtx]);

  const chooseProject = (id: string) => {
    setProjectId(id);
    const p = targets?.projects.find((x) => x.id === id);
    setProduto(p?.name ?? "");
    setMapId(p ? findProjectMap(targets?.maps ?? [], p.name)?.id ?? "" : "");
  };

  const submit = () => {
    if (!playbook || !projectId || !mapId) return;
    apply.mutate({ playbook, projectId, mapId, params }, {
      onSuccess: (r) => {
        toast.success(`${playbook.nome}: ${r.created} etapa(s) nova(s), ${r.reused} ligada(s) ao que já existia.`, {
          action: { label: "Abrir mapa", onClick: () => navigate(`/funis?view=mapa&map=${mapId}`) },
        });
        onOpenChange(false);
      },
      onError: (e) => toast.error(`Não foi possível aplicar: ${errorMessage(e)}`),
    });
  };

  const sections = plan ? [...new Set(plan.nodes.map((n) => n.stage_role))] : [];

  return (
    <Dialog open={!!playbook} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar “{playbook?.nome}”</DialogTitle>
          <DialogDescription>
            Desenha as etapas no mapa do projeto, cada uma com contrato, executor, skill e métrica. O que já existe no mapa é ligado, não duplicado. Um backup do mapa é salvo antes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Projeto</Label>
            <Select value={projectId} onValueChange={chooseProject}>
              <SelectTrigger aria-label="Projeto"><SelectValue placeholder="Escolha o projeto" /></SelectTrigger>
              <SelectContent>{targets?.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mapa</Label>
            <Select value={mapId} onValueChange={setMapId}>
              <SelectTrigger aria-label="Mapa"><SelectValue placeholder="Escolha o mapa" /></SelectTrigger>
              <SelectContent>{targets?.maps.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pb-produto">Produto nas etapas</Label>
            <Input id="pb-produto" value={produto} onChange={(e) => setProduto(e.target.value)} placeholder={project?.name ?? "Nome do produto"} />
          </div>
          {isOrganic && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pb-plataforma">Plataforma</Label>
                <Input id="pb-plataforma" value={plataforma} onChange={(e) => setPlataforma(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pb-conta">Conta (@)</Label>
                <Input id="pb-conta" value={conta} onChange={(e) => setConta(e.target.value)} placeholder="@conta" />
              </div>
            </>
          )}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          {!mapId ? (
            <p className="text-sm text-muted-foreground">Escolha o projeto e o mapa para ver o que será desenhado.</p>
          ) : loadingMap || !plan ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo o mapa...</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                <strong>{plan.created}</strong> etapa(s) nova(s) · <strong>{plan.reused}</strong> ligada(s) ao que já existe · {plan.edges.length} seta(s)
              </p>
              {sections.map((secao) => (
                <div key={secao} className="space-y-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{secao}</div>
                  <ul className="space-y-1">
                    {plan.nodes.filter((n) => n.stage_role === secao).map((n, i) => (
                      <motion.li key={n.stepOrdem} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-2 text-sm">
                        {n.existingId
                          ? <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="já existe" />
                          : <Plus className="h-3.5 w-3.5 shrink-0 text-success" aria-label="nova" />}
                        <span className="truncate">{n.label}</span>
                        {n.existingId && <span className="truncate text-xs text-muted-foreground">→ liga a “{labelOf.get(n.existingId)}”</span>}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!plan || !projectId || apply.isPending}>
            {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desenhar no mapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
