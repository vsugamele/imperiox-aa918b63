import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, CheckCheck, DollarSign, Users, ListTodo, Zap, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, any> = {
  venda: DollarSign,
  lead: Users,
  pix: DollarSign,
  tarefa: ListTodo,
  automacao: Zap,
  info: Info,
};

const TYPE_COLORS: Record<string, string> = {
  venda: "text-emerald-400",
  lead: "text-blue-400",
  pix: "text-amber-400",
  tarefa: "text-violet-400",
  automacao: "text-cyan-400",
  info: "text-muted-foreground",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const channel = supabase
      .channel("notifications-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "imphq_notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications(prev => [n, ...prev]);
        // Browser notification
        if (Notification.permission === "granted") {
          new Notification(n.title, { body: n.message || "", icon: "/favicon.ico" });
        }
      })
      .subscribe();

    // Request permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from("imphq_notifications")
      .select("id,title,message,type,entity_type,entity_id,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data as Notification[]);
  }

  async function markRead(id: string) {
    await supabase.from("imphq_notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from("imphq_notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          )}
          {notifications.map(n => {
            const Icon = TYPE_ICONS[n.type] || Info;
            const color = TYPE_COLORS[n.type] || "text-muted-foreground";
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-3 py-2.5 border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}
                onClick={() => markRead(n.id)}
              >
                <div className={`mt-0.5 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                  {n.message && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
