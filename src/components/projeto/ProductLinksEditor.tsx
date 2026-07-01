import { useMemo, useState } from "react";
import { Plus, Trash2, ExternalLink, Star, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LINK_TIPOS, PRIORIDADES, normalizeProductLinks, type ProductLink,
} from "@/lib/produto-links";

export function ProductLinksEditor({
  produto,
  onChange,
}: {
  produto: any;
  onChange: (links: ProductLink[]) => void;
}) {
  const links = useMemo(() => normalizeProductLinks(produto), [produto]);
  const [editing, setEditing] = useState<number | null>(null);

  const update = (i: number, patch: Partial<ProductLink>) => {
    const next = [...links];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const add = () => {
    onChange([
      ...links,
      { url: "", label: "", tipo: "checkout", prioridade_ia: "alternativo", contexto_ia: [], ativo: true },
    ]);
    setEditing(links.length);
  };

  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));

  const current = editing !== null ? links[editing] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Links do Produto</Label>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Link
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">Nenhum link adicionado</p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_110px_100px_36px_36px] gap-2 px-3 py-1.5 bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div>Label / URL</div>
            <div>Tipo</div>
            <div>IA</div>
            <div></div>
            <div></div>
          </div>
          {links.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_110px_100px_36px_36px] gap-2 px-3 py-2 items-center border-t border-border/60 hover:bg-secondary/30 cursor-pointer text-sm"
              onClick={() => setEditing(i)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  {l.prioridade_ia === "preferido" && <Star className="h-3 w-3 text-primary fill-primary shrink-0" />}
                  {l.prioridade_ia === "evitar" && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                  <span className="truncate font-medium">{l.label || l.url || "(sem label)"}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{l.url || "—"}</div>
                {l.observacao && (
                  <div className="text-[10px] text-muted-foreground/70 truncate italic">"{l.observacao}"</div>
                )}
              </div>
              <div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {LINK_TIPOS.find((t) => t.value === l.tipo)?.label || l.tipo}
                </Badge>
              </div>
              <div className="text-xs">
                <span className={PRIORIDADES.find((p) => p.value === l.prioridade_ia)?.tone || ""}>
                  {PRIORIDADES.find((p) => p.value === l.prioridade_ia)?.label || "—"}
                </span>
              </div>
              <a
                href={l.url || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 flex items-center justify-center text-primary hover:text-primary/80 mx-auto"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive mx-auto"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="bg-secondary/95 backdrop-blur w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar link</SheetTitle>
          </SheetHeader>
          {current && editing !== null && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  value={current.url}
                  onChange={(e) => update(editing, { url: e.target.value })}
                  placeholder="https://..."
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label (curto)</Label>
                <Input
                  value={current.label || ""}
                  onChange={(e) => update(editing, { label: e.target.value })}
                  placeholder="Ex: Checkout Pix R$ 297"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={current.tipo} onValueChange={(v: any) => update(editing, { tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LINK_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prioridade pra IA</Label>
                  <Select value={current.prioridade_ia} onValueChange={(v: any) => update(editing, { prioridade_ia: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Observação</Label>
                <Textarea
                  value={current.observacao || ""}
                  onChange={(e) => update(editing, { observacao: e.target.value })}
                  placeholder="Quando usar este link? O que ele tem de especial?"
                  className="min-h-[80px] leading-7"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contextos (separe por vírgula)</Label>
                <Input
                  value={(current.contexto_ia || []).join(", ")}
                  onChange={(e) =>
                    update(editing, {
                      contexto_ia: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="pix-quente, objeção-preço, frio..."
                />
                {!!current.contexto_ia?.length && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {current.contexto_ia.map((c, ci) => (
                      <Badge key={ci} variant="outline" className="text-[10px] gap-1">
                        {c}
                        <X
                          className="h-2.5 w-2.5 cursor-pointer"
                          onClick={() =>
                            update(editing, {
                              contexto_ia: current.contexto_ia!.filter((_, idx) => idx !== ci),
                            })
                          }
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Badge
                  variant={current.ativo !== false ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => update(editing, { ativo: !(current.ativo !== false) })}
                >
                  {current.ativo !== false ? "Ativo" : "Inativo"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  onClick={() => { remove(editing); setEditing(null); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir link
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
