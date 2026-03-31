import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ListTodo, Users, FolderKanban, CalendarIcon, Zap, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityItem {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  created_at: string;
}

const actionIcons: Record<string, any> = {
  task_created: ListTodo,
  lead_created: Users,
  project_updated: FolderKanban,
  event_created: CalendarIcon,
  routine_checked: CheckCircle2,
  lead_imported: Users,
  card_created: ListTodo,
  card_moved: FolderKanban,
};

const actionColors: Record<string, string> = {
  task_created: "text-amber-400 bg-amber-400/10",
  lead_created: "text-emerald-400 bg-emerald-400/10",
  project_updated: "text-primary bg-primary/10",
  event_created: "text-violet-400 bg-violet-400/10",
  routine_checked: "text-cyan-400 bg-cyan-400/10",
  lead_imported: "text-emerald-400 bg-emerald-400/10",
  card_created: "text-amber-400 bg-amber-400/10",
  card_moved: "text-violet-400 bg-violet-400/10",
};

const actionLabels: Record<string, string> = {
  task_created: "criou tarefa",
  lead_created: "criou lead",
  project_updated: "atualizou projeto",
  event_created: "criou evento",
  routine_checked: "completou rotina",
  lead_imported: "importou leads",
  card_created: "criou card",
  card_moved: "moveu card",
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("imphq_activity_log")
        .select("id, user_id, action, entity_type, entity_name, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (data) setActivities(data);
    }
    load();
  }, []);

  if (activities.length === 0) return null;

  return (
    <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "600ms", animationFillMode: "both" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activities.map((a) => {
          const Icon = actionIcons[a.action] || Zap;
          const color = actionColors[a.action] || "text-muted-foreground bg-muted";
          const label = actionLabels[a.action] || a.action;
          return (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
              <div className={`p-1.5 rounded-lg shrink-0 ${color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  {a.entity_name && <span className="font-medium ml-1">"{a.entity_name}"</span>}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
