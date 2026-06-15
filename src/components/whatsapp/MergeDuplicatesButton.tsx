import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Merge, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Dup {
  canonical_phone: string;
  keep_id: string;
  keep_phone: string;
  keep_msg_count: number;
  drop_id: string;
  drop_phone: string;
  drop_msg_count: number;
}

export default function MergeDuplicatesButton({ projectId }: { projectId: string | null }) {
  const [dups, setDups] = useState<Dup[]>([]);
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    if (!projectId || projectId === "all") { setDups([]); return; }
    const { data, error } = await supabase.rpc("find_wa_phone_duplicates", { p_project_id: projectId } as any);
    if (error) { console.warn("[MergeDuplicates]", error.message); return; }
    setDups((data as any) || []);
  };

  useEffect(() => { scan(); }, [projectId]);

  if (!projectId || projectId === "all" || dups.length === 0) return null;

  const mergeAll = async () => {
    setBusy(true);
    let ok = 0; let fail = 0;
    for (const d of dups) {
      const { error } = await supabase.rpc("merge_wa_conversations", {
        p_keep_id: d.keep_id, p_drop_id: d.drop_id,
      } as any);
      if (error) { fail++; console.error("[merge]", d, error.message); }
      else ok++;
    }
    setBusy(false);
    if (ok) toast.success(`${ok} conversa(s) mesclada(s)`);
    if (fail) toast.error(`${fail} falha(s) ao mesclar`);
    scan();
  };

  return (
    <button
      onClick={mergeAll}
      disabled={busy}
      className="w-full text-[11px] px-2 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
      title="Telefones que diferem apenas pelo 9º dígito do celular BR"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Merge className="h-3 w-3" />}
      {dups.length} conversa(s) duplicada(s) — clique para mesclar
    </button>
  );
}
