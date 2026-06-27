import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Trash2, Plus, Send, Calendar, Sparkles } from "lucide-react";
import { ChecklistItem, ChecklistPriority, productKey, useProductChecklist } from "@/hooks/useProductChecklist";
import { CrossProductRadar } from "./CrossProductRadar";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string | null;
  products: any[];
  currentProductName?: string | null;
  onSwitchProduct?: (idx: number) => void;
}

const PRIO: Record<ChecklistPriority, string> = {
  high: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  med: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  low: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};

const TEMPLATES: Array<{ id: string; label: string; items: Array<{ title: string; category: string; priority: ChecklistPriority }> }> = [
  {
    id: "perpetuo", label: "Perpétuo",
    items: [
      { title: "Gravar 5 criativos novos", category: "criativo", priority: "high" },
      { title: "Revisar copy do checkout", category: "copy", priority: "med" },
      { title: "Configurar order bump", category: "checkout", priority: "high" },
      { title: "Subir sequência WhatsApp 7d", category: "wa", priority: "high" },
      { title: "Auditar página de vendas", category: "copy", priority: "med" },
    ],
  },
  {
    id: "lancamento", label: "Lançamento",
    items: [
      { title: "Definir avatar + mecanismo único", category: "copy", priority: "high" },
      { title: "Criar página de captura", category: "copy", priority: "high" },
      { title: "Sequência de aquecimento (7 e-mails)", category: "copy", priority: "high" },
      { title: "Roteiro CPL/Webinar", category: "copy", priority: "high" },
      { title: "Carta de vendas + VSL", category: "copy", priority: "high" },
      { title: "Sequência carrinho aberto", category: "wa", priority: "med" },
      { title: "Recovery PIX/Boleto", category: "wa", priority: "high" },
    ],
  },
  {
    id: "x1", label: "X1 (Vendas 1:1)",
    items: [
      { title: "Script de qualificação", category: "wa", priority: "high" },
      { title: "Agenda de diagnóstico", category: "outros", priority: "med" },
      { title: "Carta de oferta personalizada", category: "copy", priority: "high" },
      { title: "Follow-up D+1, D+3, D+7", category: "wa", priority: "high" },
    ],
  },
];

export function ProductChecklistDrawer({ open, onOpenChange, projectId, products, currentProductName, onSwitchProduct }: Props) {
  const { items, add, update, remove, toKanban } = useProductChecklist(projectId);
  const [tab, setTab] = useState("produto");
  const [newTitle, setNewTitle] = useState("");
  const [newPrio, setNewPrio] = useState<ChecklistPriority>("med");
  const [newDue, setNewDue] = useState("");

  const currentKey = productKey(currentProductName);

  const productItems = useMemo(
    () => items.filter(i => i.product_id === currentKey),
    [items, currentKey]
  );

  const byProduct = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const i of items) {
      const k = i.product_id || "__projeto__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    return map;
  }, [items]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await add({
      title: newTitle.trim(),
      product_id: currentKey,
      priority: newPrio,
      due_date: newDue ? new Date(newDue).toISOString() : null,
    });
    setNewTitle(""); setNewDue("");
  };

  const applyTemplate = async (tplId: string) => {
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    for (const it of tpl.items) {
      await add({ ...it, product_id: currentKey, auto_generated: true, source: `template:${tplId}` });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] bg-[#080607] border-l border-border/60 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Check className="h-4 w-4 text-emerald-400" /> Checklist do Produto
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <CrossProductRadar
            byProduct={byProduct}
            products={products}
            currentProductName={currentProductName}
            onSwitchProduct={(name) => {
              const idx = products.findIndex((p: any) => (p?.nome || p?.name) === name);
              if (idx >= 0) onSwitchProduct?.(idx);
            }}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="produto" className="text-xs">Este produto</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="produto" className="mt-3 space-y-3">
            <div className="rounded-lg border border-border/40 bg-secondary/30 p-2 space-y-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nova tarefa…"
                className="h-8 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              <div className="flex gap-2">
                <Select value={newPrio} onValueChange={(v) => setNewPrio(v as ChecklistPriority)}>
                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="med">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <Button size="sm" onClick={handleAdd} className="h-7 px-2"><Plus className="h-3 w-3" /></Button>
              </div>
            </div>

            <div className="space-y-1.5">
              {productItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Sem tarefas para {currentProductName || "este produto"}.</p>
              )}
              {productItems.map(it => (
                <div
                  key={it.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded border text-xs",
                    it.status === "done" ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" : "bg-secondary/40 border-border/40"
                  )}
                >
                  <button
                    onClick={() => update(it.id, { status: it.status === "done" ? "todo" : "done" })}
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      it.status === "done" ? "bg-emerald-500/40 border-emerald-500/60" : "border-border/60"
                    )}
                  >
                    {it.status === "done" && <Check className="h-2.5 w-2.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("truncate", it.status === "done" && "line-through")}>{it.title}</p>
                    {(it.due_date || it.auto_generated) && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {it.due_date && <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(it.due_date).toLocaleDateString("pt-BR")}</span>}
                        {it.auto_generated && <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" />auto</span>}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0", PRIO[it.priority])}>{it.priority}</Badge>
                  {!it.kanban_card_id ? (
                    <button onClick={() => toKanban(it)} title="Enviar para Kanban" className="text-muted-foreground hover:text-primary">
                      <Send className="h-3 w-3" />
                    </button>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 border-primary/40 text-primary">kanban</Badge>
                  )}
                  <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-rose-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-3 space-y-2">
            <p className="text-[10px] text-muted-foreground px-1">Adiciona um conjunto de tarefas padrão ao produto atual.</p>
            {TEMPLATES.map(t => (
              <div key={t.id} className="rounded border border-border/40 bg-secondary/30 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{t.label}</span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => applyTemplate(t.id)}>
                    + {t.items.length} tarefas
                  </Button>
                </div>
                <ul className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                  {t.items.slice(0, 4).map((i, idx) => <li key={idx}>• {i.title}</li>)}
                  {t.items.length > 4 && <li>… +{t.items.length - 4}</li>}
                </ul>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
