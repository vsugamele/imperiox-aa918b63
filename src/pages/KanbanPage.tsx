import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const BOARDS = ["agentes", "humanas", "criativos", "campanhas"];
const COLUMNS = ["backlog", "doing", "stuck", "review", "done"];
const COL_COLORS: Record<string, string> = {
  backlog: "border-muted-foreground/30",
  doing: "border-primary/50",
  stuck: "border-destructive/50",
  review: "border-warning/50",
  done: "border-success/50",
};

export default function KanbanPage() {
  const [columns, setColumns] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [activeBoard, setActiveBoard] = useState("agentes");

  useEffect(() => {
    Promise.all([
      supabase.from("imphq_kanban_columns").select("*").order("position"),
      supabase.from("imphq_kanban_cards").select("*").order("position"),
    ]).then(([colRes, cardRes]) => {
      setColumns(colRes.data || []);
      setCards(cardRes.data || []);
    });
  }, []);

  // Fallback: if no columns in DB, use default columns
  const getCardsForColumn = (colTitle: string) => {
    const col = columns.find((c) => c.title?.toLowerCase() === colTitle);
    if (col) return cards.filter((c) => c.column_id === col.id);
    // Fallback: match by status-like metadata
    return [];
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Kanban</h1>

      <Tabs value={activeBoard} onValueChange={setActiveBoard}>
        <TabsList className="bg-secondary">
          {BOARDS.map((b) => (
            <TabsTrigger key={b} value={b} className="capitalize">{b}</TabsTrigger>
          ))}
        </TabsList>

        {BOARDS.map((board) => (
          <TabsContent key={board} value={board} className="mt-4">
            <div className="grid grid-cols-5 gap-3 min-h-[60vh]">
              {COLUMNS.map((col) => {
                const colCards = getCardsForColumn(col);
                return (
                  <div key={col} className={`rounded-lg border-t-2 ${COL_COLORS[col]} bg-secondary/30 p-3`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
                      {col}
                      <Badge variant="outline" className="text-[10px]">{colCards.length}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {colCards.map((card) => (
                        <Card key={card.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors">
                          <CardContent className="p-3">
                            <p className="text-sm font-medium">{card.title}</p>
                            {card.due_date && (
                              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                                {new Date(card.due_date).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                            {card.priority && (
                              <Badge variant="outline" className={`mt-2 text-[10px] ${card.priority === "urgent" ? "border-destructive text-destructive" : card.priority === "high" ? "border-warning text-warning" : ""}`}>
                                {card.priority}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
