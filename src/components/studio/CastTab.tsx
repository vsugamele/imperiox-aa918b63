import { useState } from "react";
import { ImageIcon, Loader2, Plus, Sparkles, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { TIPOS_AVATAR, type TipoAvatar } from "@shared/cast";
import { useCast, useGenerateCastPhotos, useSaveAvatar, useSuggestCast, useToggleAvatar, type CastAvatar } from "@/hooks/useCast";
import { useProjectsAndMaps } from "@/hooks/usePlaybooks";

const PAPEL_LABEL: Record<CastAvatar["papel"], string> = { elenco: "Aparece nas artes", publico: "Persona do público", ambos: "Aparece e é o público" };

/**
 * Elenco (OPS1.5): os avatares de cada projeto — quem aparece nas artes (com fotos de referência do mesmo rosto) e
 * para quem a copy fala (persona do público). O Estrategista atribui um avatar a cada peça e a fábrica usa as fotos.
 */
export function CastTab() {
  const { data: targets } = useProjectsAndMaps();
  const [projectId, setProjectId] = useState("");
  const { data: cast = [], isLoading } = useCast(projectId || null);
  const suggest = useSuggestCast();
  const [produto, setProduto] = useState("");
  const [publico, setPublico] = useState("");

  const sugerir = () => suggest.mutate({ project_id: projectId, produto: produto.trim() || undefined, publico: publico.trim() || undefined }, {
    onSuccess: (r) => toast.success(`${r.salvos.length} avatares criados. Agora gere as fotos de quem aparece nas artes.`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Elenco">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="h-4 w-4" /> Elenco</h2>
          <span className="text-[11px] text-muted-foreground">Quem aparece nas artes (mesmo rosto em todas) e para quem a copy fala. Personagens fictícios: nunca como "depoimento de cliente real".</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-48" aria-label="Projeto do elenco"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>{(targets?.projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Produto/oferta (opcional)" className="h-9 w-56" aria-label="Produto" />
          <Input value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Público (opcional)" className="h-9 w-56" aria-label="Público do elenco" />
          <Button size="sm" onClick={sugerir} disabled={!projectId || suggest.isPending}>
            {suggest.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />} Sugerir elenco com IA
          </Button>
        </div>
      </section>

      {projectId && <NewAvatarForm projectId={projectId} />}

      {projectId && isLoading && <p className="text-sm text-muted-foreground">Carregando elenco…</p>}
      {projectId && !isLoading && cast.length === 0 && <p className="text-sm text-muted-foreground">Nenhum avatar ainda neste projeto.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cast.map((a) => <AvatarCard key={a.id} avatar={a} projectId={projectId} />)}
      </div>
    </div>
  );
}

function AvatarCard({ avatar: a, projectId }: { avatar: CastAvatar; projectId: string }) {
  const photos = useGenerateCastPhotos();
  const toggle = useToggleAvatar();
  const f = a.ficha ?? {};
  const gerando = f._fotos?.status === "gerando";
  const aparece = a.papel !== "publico";
  return (
    <article className={cn("space-y-2 rounded-lg border border-border bg-card p-3", !a.ativo && "opacity-60")} aria-label={`Avatar ${a.nome}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><UserRound className="h-3.5 w-3.5" /> {a.nome}{f.idade ? `, ${f.idade}` : ""}</h3>
          <p className="text-[11px] text-muted-foreground">{a.tipo ? TIPOS_AVATAR[a.tipo] : "Sem tipo"} · {PAPEL_LABEL[a.papel]}{a.origem === "ia" ? " · sugerido por IA" : ""}</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggle.mutate({ id: a.id, ativo: !a.ativo, project_id: projectId })}>{a.ativo ? "Desativar" : "Ativar"}</Button>
      </div>
      {f.aparencia && <p className="text-xs text-muted-foreground">{f.aparencia}</p>}
      {f.frase && <p className="text-xs italic text-foreground">"{f.frase}"</p>}
      {(f.dores?.length ?? 0) > 0 && <p className="text-[11px] text-muted-foreground">Dores: {f.dores?.slice(0, 3).join("; ")}</p>}
      {aparece && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto">
            {a.fotos.map((p) => p.signed
              ? <img key={p.path} src={p.signed} alt={`Referência de ${a.nome}`} loading="lazy" className="h-20 w-16 shrink-0 rounded object-cover" />
              : <div key={p.path} className="flex h-20 w-16 shrink-0 items-center justify-center rounded bg-muted"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>)}
            {a.fotos.length === 0 && <p className="text-[11px] text-warning">Sem fotos: a fábrica vai inventar um rosto diferente a cada peça.</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={gerando || photos.isPending}
              onClick={() => photos.mutate({ avatar_id: a.id, project_id: projectId }, { onSuccess: () => toast.success(`Gerando fotos de ${a.nome}: 1 a 5 minutos`), onError: (e) => toast.error(errorMessage(e)) })}>
              {gerando || photos.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              {gerando ? "Gerando fotos…" : a.fotos.length ? "Mais fotos (mesmo rosto)" : "Gerar fotos (4)"}
            </Button>
            {f._fotos?.status === "parcial" && <span className="text-[11px] text-warning" title={(f._fotos.erros ?? []).join(" · ")}>algumas fotos falharam</span>}
          </div>
        </div>
      )}
    </article>
  );
}

function NewAvatarForm({ projectId }: { projectId: string }) {
  const save = useSaveAvatar();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoAvatar>("cliente");
  const [idade, setIdade] = useState("");
  const [aparencia, setAparencia] = useState("");
  const [frase, setFrase] = useState("");
  if (!aberto) return <Button size="sm" variant="outline" onClick={() => setAberto(true)}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar avatar</Button>;
  return (
    <section className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3" aria-label="Novo avatar">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="h-9 w-32" aria-label="Nome do avatar" />
      <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAvatar)}>
        <SelectTrigger className="h-9 w-56" aria-label="Tipo do avatar"><SelectValue /></SelectTrigger>
        <SelectContent>{(Object.keys(TIPOS_AVATAR) as TipoAvatar[]).map((t) => <SelectItem key={t} value={t}>{TIPOS_AVATAR[t]}</SelectItem>)}</SelectContent>
      </Select>
      <Input value={idade} onChange={(e) => setIdade(e.target.value)} placeholder="Idade" className="h-9 w-20" aria-label="Idade" />
      <Input value={aparencia} onChange={(e) => setAparencia(e.target.value)} placeholder="Aparência (cabelo, roupa, jeito)" className="h-9 min-w-[200px] flex-1" aria-label="Aparência" />
      <Input value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Uma frase que ela diria" className="h-9 min-w-[200px] flex-1" aria-label="Frase" />
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ project_id: projectId, nome, tipo, papel: tipo === "publico" ? "publico" : "elenco", ficha: { idade: idade || null, aparencia: aparencia || null, frase: frase || null } }, {
        onSuccess: () => { toast.success("Avatar criado"); setNome(""); setIdade(""); setAparencia(""); setFrase(""); setAberto(false); },
        onError: (e) => toast.error(errorMessage(e)),
      })}>Salvar</Button>
      <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
    </section>
  );
}
