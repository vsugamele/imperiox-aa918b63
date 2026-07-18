import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserCircle2, StickyNote, Trash2, Plus, BellOff, Bot, BotOff } from "lucide-react";
import { toast } from "sonner";

interface Member { id: string; user_id: string | null; name: string | null; email: string | null; avatar_url: string | null; }
interface Note { id: string; content: string; author_id: string | null; author_name: string | null; created_at: string; }

export default function AssignAndNotesBar({ conversationId }: { conversationId: string }) {
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);
  const [aiPausedUntil, setAiPausedUntil] = useState<string | null>(null);
  const [convStatus, setConvStatus] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [openNotes, setOpenNotes] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: tm } = await supabase
          .from("imphq_team_members")
          .select("name,email")
          .eq("user_id", u.user.id)
          .maybeSingle();
        setMe({ id: u.user.id, name: tm?.name || tm?.email || u.user.email || "Eu" });
      }
      const { data: mlist } = await supabase
        .from("imphq_team_members")
        .select("id,user_id,name,email,avatar_url")
        .eq("is_active", true);
      setMembers((mlist || []) as Member[]);
    })();
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    supabase.from("imphq_wa_conversations").select("assigned_to,snoozed_until,ai_paused_until").eq("id", conversationId).maybeSingle()
      .then(({ data }) => {
        setAssignedTo((data as any)?.assigned_to || null);
        setSnoozedUntil((data as any)?.snoozed_until || null);
        setAiPausedUntil((data as any)?.ai_paused_until || null);
      });
    const load = () =>
      supabase.from("imphq_wa_internal_notes")
        .select("*").eq("conversation_id", conversationId)
        .order("created_at", { ascending: false }).limit(50)
        .then(({ data }) => setNotes((data || []) as Note[]));
    load();
    const ch = supabase
      .channel(`wa-notes-${conversationId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "imphq_wa_internal_notes", filter: `conversation_id=eq.${conversationId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  const assign = async (userId: string | null) => {
    setAssignedTo(userId);
    const { error } = await supabase.from("imphq_wa_conversations").update({ assigned_to: userId } as any).eq("id", conversationId);
    if (error) { toast.error("Falha ao atribuir"); return; }
    toast.success(userId ? "Atribuída" : "Atribuição removida");
  };

  const addNote = async () => {
    const c = newNote.trim();
    if (!c) return;
    const { error } = await supabase.from("imphq_wa_internal_notes").insert({
      conversation_id: conversationId,
      author_id: me?.id || null,
      author_name: me?.name || null,
      content: c,
    } as any);
    if (error) { toast.error("Falha ao salvar nota"); return; }
    setNewNote("");
  };

  const removeNote = async (id: string) => {
    const { error } = await supabase.from("imphq_wa_internal_notes").delete().eq("id", id);
    if (error) toast.error("Falha ao apagar");
  };

  const snooze = async (mins: number | null) => {
    const until = mins === null ? null : new Date(Date.now() + mins * 60000).toISOString();
    setSnoozedUntil(until);
    const { error } = await supabase.from("imphq_wa_conversations").update({ snoozed_until: until } as any).eq("id", conversationId);
    if (error) { toast.error("Falha ao silenciar"); return; }
    toast.success(until ? `Silenciada por ${mins! < 60 ? mins + "min" : Math.round(mins!/60) + "h"}` : "Silêncio removido");
  };

  const pauseAi = async (mins: number | null) => {
    const until = mins === null ? null : new Date(Date.now() + mins * 60000).toISOString();
    setAiPausedUntil(until);
    const { error } = await supabase.from("imphq_wa_conversations").update({ ai_paused_until: until } as any).eq("id", conversationId);
    if (error) { toast.error("Falha ao pausar IA"); return; }
    toast.success(until ? `IA pausada por ${mins! < 60 ? mins + "min" : Math.round(mins!/60) + "h"}` : "IA reativada");
  };

  const isAiPaused = aiPausedUntil && new Date(aiPausedUntil).getTime() > Date.now();
  const isSnoozed = snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();
  const owner = members.find(m => m.user_id === assignedTo);

  return (
    <div className="border-b border-border bg-card/30 px-3 py-1.5 flex items-center gap-2 text-xs">
      {/* Assign */}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1.5">
            <UserCircle2 className="h-3.5 w-3.5" />
            {owner ? (
              <span className="text-foreground">{owner.name || owner.email}</span>
            ) : (
              <span className="text-muted-foreground">Sem responsável</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1 bg-popover" align="start">
          {me && (
            <button
              className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs font-medium text-primary"
              onClick={() => assign(me.id)}
            >Atribuir a mim</button>
          )}
          <div className="max-h-56 overflow-y-auto">
            {members.map(m => m.user_id && (
              <button key={m.id}
                className={`w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs ${m.user_id === assignedTo ? "bg-accent/50" : ""}`}
                onClick={() => assign(m.user_id)}
              >{m.name || m.email}</button>
            ))}
          </div>
          {assignedTo && (
            <button
              className="w-full text-left px-2 py-1.5 rounded hover:bg-destructive/20 text-xs text-destructive border-t border-border mt-1"
              onClick={() => assign(null)}
            >Remover atribuição</button>
          )}
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-border" />

      {/* Notes */}
      <Popover open={openNotes} onOpenChange={setOpenNotes}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-amber-400" />
            <span>Notas internas</span>
            {notes.length > 0 && <span className="bg-amber-500/20 text-amber-300 px-1.5 rounded-full text-[10px]">{notes.length}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2 bg-popover" align="start">
          <div className="flex gap-1 mb-2">
            <Input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }}
              placeholder="Nota visível só pra equipe…"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8 px-2" onClick={addNote}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {notes.length === 0 && <p className="text-[11px] text-muted-foreground py-4 text-center">Nenhuma nota ainda.</p>}
            {notes.map(n => (
              <div key={n.id} className="group bg-amber-500/5 border border-amber-500/20 rounded p-2 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-amber-300">🗒️ {n.author_name || "Equipe"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    {n.author_id === me?.id && (
                      <button onClick={() => removeNote(n.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-foreground/90 whitespace-pre-wrap leading-snug">{n.content}</p>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-border" />

      {/* Pausar IA */}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className={`h-7 px-2 gap-1.5 ${isAiPaused ? "text-orange-300" : ""}`}>
            {isAiPaused ? <BotOff className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            {isAiPaused ? (
              <span>IA pausada até {new Date(aiPausedUntil!).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
            ) : (
              <span>Pausar IA</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1 bg-popover" align="start">
          {[
            { label: "1 hora", min: 60 },
            { label: "4 horas", min: 240 },
            { label: "Até amanhã 8h", min: -1 },
            { label: "24 horas", min: 1440 },
          ].map(o => (
            <button key={o.label} className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs"
              onClick={() => {
                if (o.min === -1) {
                  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0);
                  pauseAi(Math.round((d.getTime() - Date.now()) / 60000));
                } else pauseAi(o.min);
              }}>{o.label}</button>
          ))}
          {isAiPaused && (
            <button className="w-full text-left px-2 py-1.5 rounded hover:bg-emerald-500/20 text-xs text-emerald-400 border-t border-border mt-1"
              onClick={() => pauseAi(null)}>Reativar IA agora</button>
          )}
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-border" />
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className={`h-7 px-2 gap-1.5 ${isSnoozed ? "text-purple-300" : ""}`}>
            <BellOff className="h-3.5 w-3.5" />
            {isSnoozed ? (
              <span>Silenciada até {new Date(snoozedUntil!).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
            ) : (
              <span>Silenciar</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1 bg-popover" align="start">
          {[
            { label: "30min", min: 30 },
            { label: "1 hora", min: 60 },
            { label: "3 horas", min: 180 },
            { label: "Até amanhã 8h", min: -1 },
          ].map(o => (
            <button key={o.label} className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs"
              onClick={() => {
                if (o.min === -1) {
                  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0);
                  snooze(Math.round((d.getTime() - Date.now()) / 60000));
                } else snooze(o.min);
              }}>{o.label}</button>
          ))}
          {isSnoozed && (
            <button className="w-full text-left px-2 py-1.5 rounded hover:bg-destructive/20 text-xs text-destructive border-t border-border mt-1"
              onClick={() => snooze(null)}>Remover silêncio</button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
