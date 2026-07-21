import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  target_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
}

interface Props {
  mapId: string;
  targetId: string | null;
  targetLabel?: string;
  onClose: () => void;
}

const table = "imphq_company_map_comments" as any;

export function MapCommentsPanel({ mapId, targetId, targetLabel, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const open = !!targetId;

  useEffect(() => {
    if (!open || !targetId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from(table)
        .select("*")
        .eq("map_id", mapId)
        .eq("target_id", targetId)
        .order("created_at", { ascending: true });
      if (active) setComments((data as any) || []);
    })();

    const ch = supabase
      .channel(`map-comments-${mapId}-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "imphq_company_map_comments", filter: `target_id=eq.${targetId}` },
        () => {
          supabase
            .from(table)
            .select("*")
            .eq("map_id", mapId)
            .eq("target_id", targetId)
            .order("created_at", { ascending: true })
            .then(({ data }) => setComments((data as any) || []));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [open, mapId, targetId]);

  const send = async () => {
    if (!body.trim() || !user || !targetId) return;
    setLoading(true);
    const name =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      user.email?.split("@")[0] ||
      "Você";
    const { error } = await supabase.from(table).insert({
      map_id: mapId,
      target_id: targetId,
      target_kind: "node",
      author_id: user.id,
      author_name: name,
      body: body.trim(),
    } as any);
    setLoading(false);
    if (error) toast.error("Falha ao enviar");
    else setBody("");
  };

  const toggleResolved = async (c: Comment) => {
    await supabase.from(table).update({ resolved: !c.resolved } as any).eq("id", c.id);
  };
  const del = async (c: Comment) => {
    await supabase.from(table).delete().eq("id", c.id);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[400px] bg-secondary/40">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Comentários {targetLabel ? `— ${targetLabel}` : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3 h-[calc(100vh-180px)]">
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground leading-7">Nenhum comentário. Comece a conversa.</p>
            )}
            {comments.map((c) => (
              <div
                key={c.id}
                className={`rounded border border-border/40 p-2 text-sm leading-6 ${c.resolved ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{c.author_name || "Anônimo"}</span>
                  <span>{formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
                <div className="mt-1 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleResolved(c)} className="h-6 px-2 text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    {c.resolved ? "Reabrir" : "Resolver"}
                  </Button>
                  {c.author_id === user?.id && (
                    <Button size="sm" variant="ghost" onClick={() => del(c)} className="h-6 px-2 text-xs">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border/40 pt-2 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva um comentário..."
              className="min-h-[72px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
            />
            <Button onClick={send} disabled={loading || !body.trim()} size="sm" className="w-full">
              Enviar (Ctrl+Enter)
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
