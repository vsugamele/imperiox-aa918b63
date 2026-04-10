import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Log {
  id: string;
  step_id: string | null;
  group_jid: string;
  status: string;
  error: string | null;
  executed_at: string;
}

export default function CampaignLogViewer({ campaignId }: { campaignId: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_wa_campaign_logs")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("executed_at", { ascending: false })
        .limit(100);
      setLogs((data as any[]) || []);
      setLoading(false);
    })();
  }, [campaignId]);

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Nenhum envio registrado ainda.</p>;
  }

  return (
    <ScrollArea className="max-h-[65vh]">
      <div className="space-y-1.5 p-1">
        {logs.map(log => (
          <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded bg-muted/30 text-xs">
            <Badge
              className={`text-[9px] ${log.status === "sent" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
            >
              {log.status}
            </Badge>
            <span className="truncate flex-1 text-muted-foreground">{log.group_jid}</span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {new Date(log.executed_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            {log.error && (
              <span className="text-[10px] text-red-400 truncate max-w-[150px]" title={log.error}>{log.error}</span>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
