import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Download, SquareArrowOutUpRight, Plus, Search } from "lucide-react";
import { METRIC_FIELDS, formatMetric, autoStatusColor } from "./kanbanTemplates";
import type { KanbanBoard } from "./BoardTabsBar";

interface KanbanCard {
  id: string;
  column_id: string;
  title: string;
  priority: string;
  due_date?: string;
  tags: string[];
  board: string;
  member_id?: string;
  project_id?: string;
  metrics?: Record<string, any> | null;
  status_color?: string | null;
}

interface Column {
  id: string;
  title: string;
  color?: string;
  board: string;
}

interface Props {
  cards: KanbanCard[];
  columns: Column[];
  members: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  boards?: KanbanBoard[];
  onReload: () => void;
  onOpenCard?: (card: KanbanCard) => void;
}

type GroupKey = "column" | "board" | "member" | "roi" | "priority" | "none";

const GROUP_LABELS: Record<GroupKey, string> = {
  column: "Status (coluna)",
  board: "Board",
  member: "Responsável",
  roi: "Faixa de ROI",
  priority: "Prioridade",
  none: "Sem agrupamento",
};

const PRESETS: Array<{ id: string; label: string; test: (c: KanbanCard) => boolean }> = [
  { id: "winners", label: "Vencedores (ROI ≥ 2)", test: (c) => Number(c.metrics?.roi) >= 2 },
  { id: "testing", label: "Testando", test: (c) => /test|rodando|validando/i.test(c.metrics?.stage || "") || (Number(c.metrics?.roi) >= 1 && Number(c.metrics?.roi) < 1.5) },
  { id: "losing", label: "Perdendo (ROI < 1)", test: (c) => Number(c.metrics?.roi) < 1 && Number.isFinite(Number(c.metrics?.roi)) },
  { id: "unassigned", label: "Sem responsável", test: (c) => !c.member_id },
  { id: "duesoon", label: "Vence em 3 dias", test: (c) => {
      if (!c.due_date) return false;
      const d = new Date(c.due_date).getTime() - Date.now();
      return d >= 0 && d <= 3 * 86400_000;
    } },
];

export function KanbanSheetView({ cards, columns, members, projects, boards = [], onReload, onOpenCard }: Props) {
  const [projectSearch, setProjectSearch] = useState("");
  const boardOptions = boards.filter((b) => b.id !== "geral" && b.id !== "experts");
  const [groupBy, setGroupBy] = useState<GroupKey>("column");
  const [preset, setPreset] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const colName = (id: string) => columns.find((c) => c.id === id)?.title || "—";
  const memberName = (id?: string) => members.find((m) => m.id === id)?.name || "—";
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name || "—";

  const filtered = useMemo(() => {
    let list = cards;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || (c.tags || []).some((t) => t.toLowerCase().includes(q)));
    }
    const p = PRESETS.find((x) => x.id === preset);
    if (p) list = list.filter(p.test);
    return list;
  }, [cards, search, preset]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "Todos", rows: filtered }];
    const map = new Map<string, KanbanCard[]>();
    filtered.forEach((c) => {
      let key = "—";
      if (groupBy === "column") key = colName(c.column_id);
      else if (groupBy === "board") key = c.board;
      else if (groupBy === "member") key = memberName(c.member_id);
      else if (groupBy === "priority") key = c.priority || "medium";
      else if (groupBy === "roi") {
        const roi = Number(c.metrics?.roi);
        if (!Number.isFinite(roi)) key = "Sem ROI";
        else if (roi >= 2) key = "Vencedores (≥2x)";
        else if (roi >= 1.5) key = "Bons (1.5–2x)";
        else if (roi >= 1) key = "Break-even (1–1.5x)";
        else key = "Perdendo (<1x)";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries()).map(([label, rows]) => ({ key: label, label, rows }));
  }, [filtered, groupBy]);

  const groupAgg = (rows: KanbanCard[]) => {
    const rois = rows.map((r) => Number(r.metrics?.roi)).filter((n) => Number.isFinite(n));
    const hooks = rows.map((r) => Number(r.metrics?.hook_rate)).filter((n) => Number.isFinite(n));
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    return { avgRoi: avg(rois), avgHook: avg(hooks) };
  };

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const updateField = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase as any).from("imphq_kanban_cards").update(patch).eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    onReload();
  };

  const updateMetric = async (id: string, key: string, raw: string) => {
    const card = cards.find((c) => c.id === id);
    const parsed = raw === "" ? undefined : Number(raw.replace(",", "."));
    const metrics = { ...(card?.metrics || {}) };
    if (parsed === undefined || !Number.isFinite(parsed)) delete metrics[key];
    else metrics[key] = parsed;
    await updateField(id, { metrics });
  };

  const bulkMove = async (colId: string) => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const { error } = await (supabase as any).from("imphq_kanban_cards").update({ column_id: colId }).in("id", ids);
    if (error) { toast.error("Erro"); return; }
    toast.success(`${ids.length} cards movidos`);
    setSelected(new Set());
    onReload();
  };

  const exportCsv = () => {
    const header = ["Título", "Board", "Status", "Prioridade", "Prazo", "Responsável", "Projeto", ...METRIC_FIELDS.map((m) => m.label)];
    const rows = filtered.map((c) => [
      c.title,
      c.board,
      colName(c.column_id),
      c.priority,
      c.due_date || "",
      memberName(c.member_id),
      projectName(c.project_id),
      ...METRIC_FIELDS.map((m) => (c.metrics?.[m.key] ?? "")),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
        <Input
          placeholder="Buscar título ou tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs max-w-[240px]"
        />
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupKey)}>
          <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(GROUP_LABELS) as GroupKey[]).map((k) => (
              <SelectItem key={k} value={k}>Agrupar: {GROUP_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cards</SelectItem>
            {PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary" className="h-8 text-xs">
                  {selected.size} selecionados · Mover para…
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="end">
                {columns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => bulkMove(c.id)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color || "#8b5cf6" }} />
                    {c.title} <span className="text-muted-foreground/60 ml-auto">{c.board}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCsv}>
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30 hover:bg-secondary/30">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Tarefa</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Board</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Projeto</TableHead>
              {METRIC_FIELDS.map((m) => (
                <TableHead key={m.key} className="text-[10px] uppercase tracking-wider text-right">{m.label}</TableHead>
              ))}
              <TableHead className="text-[10px] uppercase tracking-wider">Prazo</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const isCol = collapsed.has(g.key);
              const agg = groupAgg(g.rows);
              return (
                <>
                  {groupBy !== "none" && (
                    <TableRow key={"h-" + g.key} className="bg-muted/20 hover:bg-muted/30 cursor-pointer" onClick={() => toggle(g.key)}>
                      <TableCell className="py-1.5">
                        {isCol ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </TableCell>
                      <TableCell colSpan={4} className="py-1.5">
                        <span className="text-xs font-semibold text-foreground">{g.label}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5">{g.rows.length}</Badge>
                      </TableCell>
                      <TableCell colSpan={METRIC_FIELDS.length + 2} className="py-1.5 text-right">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {agg.avgRoi !== null && <>Ø ROI {agg.avgRoi.toFixed(2).replace(".", ",")}x</>}
                          {agg.avgRoi !== null && agg.avgHook !== null && <> · </>}
                          {agg.avgHook !== null && <>Ø hook {agg.avgHook.toFixed(1).replace(".", ",")}%</>}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isCol && g.rows.map((c) => {
                    const auto = autoStatusColor(c.metrics || undefined);
                    const dotColor = c.status_color || auto;
                    const isSel = selected.has(c.id);
                    return (
                      <TableRow key={c.id} className={isSel ? "bg-primary/5" : ""}>
                        <TableCell className="py-1">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(c.id) : next.delete(c.id);
                                return next;
                              });
                            }}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <button
                            onClick={() => onOpenCard?.(c)}
                            className="group flex items-center gap-2 text-left w-full hover:text-primary"
                          >
                            {dotColor && (
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                dotColor === "green" ? "bg-success" : dotColor === "yellow" ? "bg-warning" : "bg-destructive"
                              }`} />
                            )}
                            <span className="text-xs">{c.title}</span>
                            <SquareArrowOutUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
                          </button>
                        </TableCell>
                        <TableCell className="py-1 text-xs text-muted-foreground">{colName(c.column_id)}</TableCell>
                        <TableCell className="py-1">
                          {boardOptions.length > 0 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-[9px] px-1.5 py-0.5 rounded border border-border/60 hover:border-primary/60 capitalize">
                                  {boards.find((b) => b.id === c.board)?.label || c.board}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-1" align="start">
                                {boardOptions.map((b) => (
                                  <button
                                    key={b.id}
                                    onClick={() => updateField(c.id, { board: b.id })}
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                                  >
                                    {b.emoji && <span>{b.emoji}</span>}
                                    <span>{b.label}</span>
                                    {c.board === b.id && <span className="ml-auto text-primary">✓</span>}
                                  </button>
                                ))}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">{c.board}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1">
                          <Popover onOpenChange={(o) => !o && setProjectSearch("")}>
                            <PopoverTrigger asChild>
                              <button className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[160px]">
                                {c.project_id ? projectName(c.project_id) : <span className="text-muted-foreground/40">— definir —</span>}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-1" align="start">
                              <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border/40 mb-1">
                                <Search className="h-3 w-3 text-muted-foreground" />
                                <input
                                  placeholder="Buscar projeto…"
                                  value={projectSearch}
                                  onChange={(e) => setProjectSearch(e.target.value)}
                                  className="flex-1 text-xs bg-transparent outline-none"
                                />
                              </div>
                              <div className="max-h-64 overflow-auto">
                                <button
                                  onClick={() => updateField(c.id, { project_id: null })}
                                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground"
                                >
                                  Sem projeto
                                </button>
                                {projects
                                  .filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                                  .slice(0, 40)
                                  .map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => updateField(c.id, { project_id: p.id })}
                                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                                    >
                                      <span className="truncate">{p.name}</span>
                                      {c.project_id === p.id && <span className="ml-auto text-primary">✓</span>}
                                    </button>
                                  ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        {METRIC_FIELDS.map((m) => {
                          const val = c.metrics?.[m.key];
                          const isEditing = editing?.id === c.id && editing?.field === m.key;
                          return (
                            <TableCell key={m.key} className="py-1 text-right tabular-nums">
                              {isEditing ? (
                                <Input
                                  autoFocus
                                  defaultValue={val ?? ""}
                                  onBlur={(e) => { updateMetric(c.id, m.key, e.target.value); setEditing(null); }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                  className="h-6 text-xs text-right w-16 ml-auto"
                                />
                              ) : (
                                <button
                                  onClick={() => setEditing({ id: c.id, field: m.key })}
                                  className="text-xs hover:text-foreground text-muted-foreground w-full text-right"
                                >
                                  {val !== undefined && val !== null && val !== "" ? formatMetric(val, m.format) : <span className="text-muted-foreground/30">—</span>}
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="py-1 text-xs text-muted-foreground">
                          {editing?.id === c.id && editing?.field === "due_date" ? (
                            <Input
                              type="date"
                              autoFocus
                              defaultValue={c.due_date?.slice(0, 10) || ""}
                              onBlur={(e) => { updateField(c.id, { due_date: e.target.value || null }); setEditing(null); }}
                              className="h-6 text-xs w-32"
                            />
                          ) : (
                            <button onClick={() => setEditing({ id: c.id, field: "due_date" })} className="hover:text-foreground">
                              {c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "—"}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-xs text-muted-foreground">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="hover:text-foreground">
                                {c.member_id ? memberName(c.member_id) : <span className="text-muted-foreground/40">—</span>}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1" align="start">
                              <button
                                onClick={() => updateField(c.id, { member_id: null })}
                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground"
                              >
                                Sem responsável
                              </button>
                              {members.map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => updateField(c.id, { member_id: m.id })}
                                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                                >
                                  <span>{m.name}</span>
                                  {c.member_id === m.id && <span className="ml-auto text-primary">✓</span>}
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={METRIC_FIELDS.length + 7} className="text-center py-8 text-xs text-muted-foreground">
                  Nenhum card encontrado com esse filtro
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
