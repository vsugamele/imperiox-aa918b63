import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { EditableTagList } from "../EditableTagList";
import { AIGenerateButton } from "../AIGenerateButton";
import { toast } from "sonner";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
  projectId?: string;
}

// ── Headlines importadas (.hl-card) ─────────────────────────────────────────
function HeadlinesSection({ avatar, onUpdate, projectId }: Props) {
  const headlines: any[] = avatar.headlines || [];
  const add = () => onUpdate({ ...avatar, headlines: [...headlines, { categoria: "", texto: "" }] });
  const remove = (i: number) => onUpdate({ ...avatar, headlines: headlines.filter((_: any, j: number) => j !== i) });
  const edit = (i: number, key: string, val: string) => {
    const u = [...headlines];
    u[i] = { ...u[i], [key]: val };
    onUpdate({ ...avatar, headlines: u });
  };

  const handleAnglesResult = (data: any) => {
    const novos = (data?.angles?.angulos || data?.angulos || []).map((a: any) => ({
      categoria: a.categoria || "Avatar",
      texto: a.texto || "",
    })).filter((a: any) => a.texto);
    if (!novos.length) {
      toast.error("IA não retornou ângulos.");
      return;
    }
    onUpdate({ ...avatar, headlines: [...headlines, ...novos] });
    toast.success(`${novos.length} ângulos gerados a partir do Avatar!`);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📰 Headlines</CardTitle>
        <div className="flex gap-2">
          {projectId && (
            <AIGenerateButton
              projectId={projectId}
              action="generate_avatar_angles"
              onResult={handleAnglesResult}
              contextSources={["Avatar"]}
              fieldsToFill={["Headlines"]}
              label="Avatar → 5 Ângulos"
              size="sm"
            />
          )}
          <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {headlines.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma headline. Importe o HTML ou adicione manualmente.</p>}
        {headlines.map((h: any, i: number) => (
          <div key={i} className="flex gap-2 items-start group">
            <div className="flex-1 space-y-1">
              <Input
                value={h.categoria || ""}
                onChange={e => edit(i, "categoria", e.target.value)}
                className="bg-secondary text-xs h-7"
                placeholder="Categoria (ex: Headline 1.1)"
              />
              <Textarea
                value={h.texto || ""}
                onChange={e => edit(i, "texto", e.target.value)}
                className="bg-secondary text-sm min-h-[40px]"
                placeholder="Texto da headline..."
              />
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0 mt-1 opacity-0 group-hover:opacity-100" onClick={() => remove(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Anúncios importados (.ad-card) ───────────────────────────────────────────
function AnunciosSection({ avatar, onUpdate }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const anuncios: any[] = avatar.anuncios || [];
  const add = () => onUpdate({ ...avatar, anuncios: [...anuncios, { angulo: "", avatar_alvo: "", hook: "", corpo: "", cta: "" }] });
  const remove = (i: number) => onUpdate({ ...avatar, anuncios: anuncios.filter((_: any, j: number) => j !== i) });
  const edit = (i: number, key: string, val: string) => {
    const u = [...anuncios];
    u[i] = { ...u[i], [key]: val };
    onUpdate({ ...avatar, anuncios: u });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📢 Scripts de Anúncios</CardTitle>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {anuncios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum anúncio. Importe o HTML ou adicione manualmente.</p>}
        {anuncios.map((ad: any, i: number) => (
          <div key={i} className="rounded-md border border-border overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary/50"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {open === i ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span className="flex-1 text-sm font-medium truncate">{ad.angulo || `Anúncio ${i + 1}`}</span>
              {ad.avatar_alvo && <Badge variant="outline" className="text-[9px]">{ad.avatar_alvo}</Badge>}
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={e => { e.stopPropagation(); remove(i); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {open === i && (
              <div className="border-t border-border px-3 py-3 bg-secondary/30 space-y-2">
                {[
                  { key: "angulo", label: "Ângulo" },
                  { key: "avatar_alvo", label: "Avatar Alvo" },
                  { key: "hook", label: "Hook (3s)", textarea: true },
                  { key: "corpo", label: "Corpo", textarea: true },
                  { key: "cta", label: "CTA" },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                    {f.textarea ? (
                      <Textarea value={ad[f.key] || ""} onChange={e => edit(i, f.key, e.target.value)} className="bg-secondary text-sm min-h-[50px] mt-0.5" />
                    ) : (
                      <Input value={ad[f.key] || ""} onChange={e => edit(i, f.key, e.target.value)} className="bg-secondary text-sm mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── VSL Timeline ──────────────────────────────────────────────────────────────
function VslSection({ avatar, onUpdate }: Props) {
  const vsl: any[] = avatar.vsl_timeline || [];
  const add = () => onUpdate({ ...avatar, vsl_timeline: [...vsl, { tempo: "", titulo: "", corpo: "" }] });
  const remove = (i: number) => onUpdate({ ...avatar, vsl_timeline: vsl.filter((_: any, j: number) => j !== i) });
  const edit = (i: number, key: string, val: string) => {
    const u = [...vsl];
    u[i] = { ...u[i], [key]: val };
    onUpdate({ ...avatar, vsl_timeline: u });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎬 VSL Timeline</CardTitle>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {vsl.length === 0 && <p className="text-sm text-muted-foreground">Nenhum bloco VSL.</p>}
        {vsl.map((block: any, i: number) => (
          <div key={i} className="flex gap-2 items-start border-l-2 border-primary/30 pl-3 group">
            <div className="flex-1 space-y-1">
              <Input value={block.tempo || ""} onChange={e => edit(i, "tempo", e.target.value)} className="bg-secondary text-xs h-7" placeholder="Tempo (ex: 0:00 – 0:30)" />
              <Input value={block.titulo || ""} onChange={e => edit(i, "titulo", e.target.value)} className="bg-secondary text-sm font-medium" placeholder="Título do bloco..." />
              <Textarea value={block.corpo || ""} onChange={e => edit(i, "corpo", e.target.value)} className="bg-secondary text-sm min-h-[50px]" placeholder="Conteúdo..." />
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0 opacity-0 group-hover:opacity-100" onClick={() => remove(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Objeções (string[]) ───────────────────────────────────────────────────────
function ObjecoesSection({ avatar, onUpdate }: Props) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🛡️ Objeções & Viradas</CardTitle>
      </CardHeader>
      <CardContent>
        <EditableTagList
          tags={avatar.objecoes || []}
          onChange={v => onUpdate({ ...avatar, objecoes: v })}
        />
        {(avatar.objecoes || []).length === 0 && (
          <p className="text-sm text-muted-foreground mt-1">Importe o HTML para preencher automaticamente.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Página de Vendas (.copy-block) ────────────────────────────────────────────
function PaginaVendasSection({ avatar, onUpdate }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const pagina: any[] = avatar.pagina_vendas || [];

  if (pagina.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🛒 Página de Vendas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {pagina.map((block: any, i: number) => (
          <div key={i} className="rounded-md border border-border overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary/50"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {open === i ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <Badge variant="outline" className="text-[9px] shrink-0">{block.label || `Bloco ${i + 1}`}</Badge>
              <span className="text-sm truncate flex-1">{block.titulo || ""}</span>
            </div>
            {open === i && (
              <div className="border-t border-border px-3 py-3 bg-secondary/30">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{block.corpo || block.titulo || ""}</p>
                {block.nota && <p className="text-xs text-muted-foreground mt-2 italic">{block.nota}</p>}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Value Stack ───────────────────────────────────────────────────────────────
function ValueStackSection({ avatar, onUpdate }: Props) {
  const stack: any[] = avatar.value_stack || [];
  if (stack.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">💰 Value Stack</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {stack.map((item: any, i: number) => (
          <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md border ${item.principal ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30"}`}>
            <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{item.numero || i + 1}</span>
            <span className="flex-1 text-sm">{item.titulo}</span>
            {item.valor && <Badge variant="outline" className="text-xs font-mono text-emerald-400 border-emerald-500/30">{item.valor}</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Palavras-Gatilho ──────────────────────────────────────────────────────────
function PalavrasSection({ avatar, onUpdate }: Props) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔤 Palavras-Gatilho</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { key: "palavras_dor", label: "Dor", color: "text-red-400" },
          { key: "palavras_desejo", label: "Desejo", color: "text-blue-400" },
          { key: "palavras_solucao", label: "Solução", color: "text-emerald-400" },
          { key: "palavras_valor", label: "Valor/Validação", color: "text-yellow-400" },
        ].map(p => (
          <div key={p.key}>
            <Label className={`text-xs font-semibold ${p.color}`}>{p.label}</Label>
            <EditableTagList tags={avatar[p.key] || []} onChange={v => onUpdate({ ...avatar, [p.key]: v })} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Frases-Gatilho ────────────────────────────────────────────────────────────
function FrasesSection({ avatar }: { avatar: any }) {
  const dor = avatar.frases_gatilho_dor || [];
  const desejo = avatar.frases_gatilho_desejo || [];
  const decisao = avatar.frases_gatilho_decisao || [];
  if (!dor.length && !desejo.length && !decisao.length) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🗣️ Frases-Gatilho</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dor.length > 0 && (
          <div>
            <Label className="text-xs font-semibold text-red-400">Dor</Label>
            <div className="space-y-1 mt-1">
              {dor.map((f: string, i: number) => <p key={i} className="text-sm text-foreground/80 border-l-2 border-red-500/40 pl-2 italic">{f}</p>)}
            </div>
          </div>
        )}
        {desejo.length > 0 && (
          <div>
            <Label className="text-xs font-semibold text-blue-400">Desejo</Label>
            <div className="space-y-1 mt-1">
              {desejo.map((f: string, i: number) => <p key={i} className="text-sm text-foreground/80 border-l-2 border-blue-500/40 pl-2 italic">{f}</p>)}
            </div>
          </div>
        )}
        {decisao.length > 0 && (
          <div>
            <Label className="text-xs font-semibold text-emerald-400">Decisão</Label>
            <div className="space-y-1 mt-1">
              {decisao.map((f: string, i: number) => <p key={i} className="text-sm text-foreground/80 border-l-2 border-emerald-500/40 pl-2 italic">{f}</p>)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export function CopyArsenalTab({ avatar, onUpdate, projectId }: Props) {
  return (
    <div className="space-y-6">
      <HeadlinesSection avatar={avatar} onUpdate={onUpdate} projectId={projectId} />
      <AnunciosSection avatar={avatar} onUpdate={onUpdate} />
      <ObjecoesSection avatar={avatar} onUpdate={onUpdate} />
      <VslSection avatar={avatar} onUpdate={onUpdate} />
      <PaginaVendasSection avatar={avatar} onUpdate={onUpdate} />
      <ValueStackSection avatar={avatar} onUpdate={onUpdate} />
      <PalavrasSection avatar={avatar} onUpdate={onUpdate} />
      <FrasesSection avatar={avatar} />
    </div>
  );
}
