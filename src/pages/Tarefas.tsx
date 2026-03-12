import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export default function Tarefas() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    supabase.from("imphq_tasks").select("*").order("due_date", { ascending: true }).then(({ data }) => setTasks(data || []));
  }, []);

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isOverdue = (d: string | null) => d && new Date(d) < new Date();
  const isNear = (d: string | null) => {
    if (!d) return false;
    const diff = new Date(d).getTime() - Date.now();
    return diff > 0 && diff < 3 * 86400000;
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Tarefas</h1>

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 bg-secondary" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="doing">Doing</SelectItem>
            <SelectItem value="stuck">Stuck</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{t.status || "backlog"}</Badge></TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${t.priority === "urgent" ? "border-destructive text-destructive" : t.priority === "high" ? "border-warning text-warning" : ""}`}>
                    {t.priority || "normal"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.project_id || "—"}</TableCell>
                <TableCell>
                  {t.due_date ? (
                    <span className={`text-xs font-mono ${isOverdue(t.due_date) ? "text-destructive" : isNear(t.due_date) ? "text-warning" : "text-muted-foreground"}`}>
                      {new Date(t.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
