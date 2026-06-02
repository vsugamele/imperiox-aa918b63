import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, Trash2, Phone, Tag, X, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
  provider_id: string | null;
}

interface CrmData {
  id?: string;
  conversation_id: string;
  stage: string;
  tags: string[];
  notes: string;
  value: number;
}

interface Props {
  session: WaSession;
  projectName: string;
  providerLabel: string;
  onDelete: (id: string) => void;
}

const STAGES = [
  { value: "lead", label: "🟡 Lead" },
  { value: "prospect", label: "🟠 Prospect" },
  { value: "negociacao", label: "🔵 Negociação" },
  { value: "cliente", label: "🟢 Cliente" },
  { value: "perdido", label: "🔴 Perdido" },
];

export default function SessionDetailView({ session, projectName, providerLabel, onDelete }: Props) {
  const [crm, setCrm] = useState<CrmData>({ conversation_id: session.id, stage: "lead", tags: [], notes: "", value: 0 });
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<{ id: string; subject: string }[] | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const fetchCommonGroups = useCallback(async () => {
    if (!session.provider_id) {
      setGroups([]);
      return;
    }
    setLoadingGroups(true);
    setGroups(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=fetch_common_groups", {
        body: { provider_id: session.provider_id, phone: session.phone },
      });
      if (error) throw error;
      if (data?.success) {
        setGroups(data.groups || []);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("[SessionDetailView] error fetching groups:", err);
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, [session.provider_id, session.phone]);

  useEffect(() => {
    fetchCommonGroups();
  }, [fetchCommonGroups]);

  const loadCrm = useCallback(async () => {
    const { data } = await supabase
      .from("imphq_wa_crm")
      .select("*")
      .eq("conversation_id", session.id)
      .maybeSingle();
    if (data) {
      setCrm({
        id: data.id,
        conversation_id: data.conversation_id,
        stage: data.stage,
        tags: Array.isArray(data.tags) ? data.tags : [],
        notes: data.notes || "",
        value: Number(data.value) || 0,
      });
    } else {
      setCrm({ conversation_id: session.id, stage: "lead", tags: [], notes: "", value: 0 });
    }
  }, [session.id]);

  useEffect(() => { loadCrm(); }, [loadCrm]);

  const saveCrm = async () => {
    setSaving(true);
    const payload = {
      conversation_id: session.id,
      stage: crm.stage,
      tags: crm.tags as any,
      notes: crm.notes,
      value: crm.value,
    };

    if (crm.id) {
      await supabase.from("imphq_wa_crm").update(payload as any).eq("id", crm.id);
    } else {
      const { data } = await supabase.from("imphq_wa_crm").insert(payload as any).select().single();
      if (data) setCrm(prev => ({ ...prev, id: data.id }));
    }
    toast.success("CRM salvo!");
    setSaving(false);
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    if (!crm.tags.includes(tag)) {
      setCrm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setCrm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const getWaLink = () => {
    const clean = session.phone.replace(/\D/g, "");
    const msg = (session.metadata as any)?.default_message;
    return `https://wa.me/${clean}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
  };

  const waLink = getWaLink();

  return (
    <div className="space-y-4">
      {/* Session Info */}
      <Card className="bg-card border-border">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{session.contact_name || session.phone}</h3>
              <p className="text-sm text-muted-foreground font-mono">{session.phone}</p>
            </div>
            <Badge variant="outline" className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              {session.status}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Projeto</span><span>{projectName}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sessão</span><span className="font-mono text-xs">{session.session}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mensagens</span><span className="font-mono">{session.message_count}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Provider</span><span>{providerLabel}</span></div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Link direto:</p>
            <div className="p-2 bg-secondary rounded text-xs text-primary break-all font-mono">{waLink}</div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(waLink); toast.success("Link copiado!"); }}>
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Abrir WA</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grupos em Comum */}
      {session.provider_id && (
        <Card className="bg-card border-border">
          <CardContent className="space-y-3 pt-5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Grupos em Comum
            </h4>

            {loadingGroups ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Buscando grupos em comum...</span>
              </div>
            ) : groups === null ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Carregando...</p>
            ) : groups.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhum grupo em comum encontrado.</p>
            ) : (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-2 bg-secondary/30 border border-border/50 rounded-md text-xs">
                    <span className="font-medium truncate max-w-[200px]" title={g.subject}>{g.subject}</span>
                    <Badge variant="secondary" className="text-[9px] scale-90 select-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Membro
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CRM Section */}
      <Card className="bg-card border-border">
        <CardContent className="space-y-3 pt-5">
          <h4 className="font-semibold text-sm flex items-center gap-1.5">📊 Mini-CRM</h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Estágio</Label>
              <Select value={crm.stage} onValueChange={v => setCrm(prev => ({ ...prev, stage: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Valor (R$)</Label>
              <Input type="number" className="h-8 text-xs" value={crm.value} onChange={e => setCrm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Tags</Label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {crm.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] gap-0.5">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1">
              <Input className="h-7 text-xs flex-1" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nova tag..." onKeyDown={e => e.key === "Enter" && addTag()} />
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addTag}><Tag className="h-3 w-3" /></Button>
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Notas</Label>
            <Textarea className="text-xs min-h-[60px]" value={crm.notes} onChange={e => setCrm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Anotações sobre o contato..." />
          </div>

          <Button size="sm" onClick={saveCrm} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "💾 Salvar CRM"}
          </Button>
        </CardContent>
      </Card>

      {/* Delete */}
      <Button size="sm" variant="destructive" onClick={() => onDelete(session.id)} className="w-full">
        <Trash2 className="h-3 w-3 mr-1" /> Excluir Sessão
      </Button>
    </div>
  );
}
