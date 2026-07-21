import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Loader2, Users, Save, RefreshCw, Trash2, Bookmark } from "lucide-react";
import { toast } from "sonner";

export interface AudienceFilters {
  temperature?: string[];
  conv_status?: string[];
  current_intent?: string[];
  intent_tags_any?: string[];
  buy_intent_detected?: boolean;
  emotional_state?: string[];
  has_pitch?: boolean;
  last_message_within_days?: number;
  last_message_older_than_days?: number;
  bought_produto?: string;
  never_bought?: boolean;
  nome_search?: string;
  exclude_segment_id?: string;
}

interface Props {
  projectId: string;
  value?: AudienceFilters;
  onChange?: (f: AudienceFilters, sample: any[]) => void;
  compact?: boolean;
}

const TEMP_OPTS = ["hot", "warm", "cold"];
const STATUS_OPTS = ["aberto", "em_atendimento", "aguardando_cliente", "resolvido", "needs_human"];
const INTENT_OPTS = ["comprar", "duvida", "objecao", "curioso", "reclamacao", "suporte"];

export default function AudiencePreviewPanel({ projectId, value, onChange, compact }: Props) {
  const [filters, setFilters] = useState<AudienceFilters>(value || {});
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [segments, setSegments] = useState<any[]>([]);

  const set = <K extends keyof AudienceFilters>(k: K, v: AudienceFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const toggleArr = (k: keyof AudienceFilters, v: string) => {
    setFilters((f) => {
      const cur = (f[k] as string[]) || [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...f, [k]: next.length ? next : undefined };
    });
  };

  const preview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-audience-preview", {
        body: { ...filters, project_id: projectId },
      });
      if (error) throw error;
      setCount(data.count);
      setSample(data.sample || []);
      setBreakdown(data.breakdown || {});
      onChange?.(filters, data.sample || []);
    } catch (e: any) {
      toast.error(e.message || "Falha no preview");
    } finally {
      setLoading(false);
    }
  };

  const loadSegments = async () => {
    const { data } = await supabase
      .from("imphq_wa_audience_segments")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    setSegments(data || []);
  };

  useEffect(() => {
    loadSegments();
  }, [projectId]);

  // Debounced auto-preview
  useEffect(() => {
    const t = setTimeout(preview, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), projectId]);

  const save = async () => {
    if (!saveName.trim()) return toast.error("Dê um nome ao segmento");
    const { error } = await supabase.from("imphq_wa_audience_segments").insert({
      project_id: projectId,
      nome: saveName.trim(),
      filters: filters as any,
      last_count: count,
      last_previewed_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Segmento salvo");
    setSaveName("");
    loadSegments();
  };

  const applySegment = (s: any) => {
    setFilters(s.filters || {});
    toast.success(`Carregado: ${s.nome}`);
  };

  const removeSegment = async (id: string) => {
    if (!confirm("Excluir segmento?")) return;
    await supabase.from("imphq_wa_audience_segments").delete().eq("id", id);
    loadSegments();
  };

  const clearAll = () => setFilters({});

  return (
    <div className="grid gap-4">
      {/* Segmentos salvos */}
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Bookmark className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground mr-1">Salvos:</span>
          {segments.map((s) => (
            <Badge
              key={s.id}
              variant="outline"
              className="cursor-pointer group hover:border-primary"
              onClick={() => applySegment(s)}
            >
              {s.nome} · {s.last_count ?? "?"}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSegment(s.id);
                }}
                className="ml-1 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className={compact ? "grid gap-3" : "grid md:grid-cols-2 gap-4"}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Temperatura</Label>
            <div className="flex gap-1 mt-1">
              {TEMP_OPTS.map((t) => (
                <Badge
                  key={t}
                  variant={filters.temperature?.includes(t) ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleArr("temperature", t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Status da conversa</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {STATUS_OPTS.map((t) => (
                <Badge
                  key={t}
                  variant={filters.conv_status?.includes(t) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleArr("conv_status", t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Intent atual</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {INTENT_OPTS.map((t) => (
                <Badge
                  key={t}
                  variant={filters.current_intent?.includes(t) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleArr("current_intent", t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={!!filters.buy_intent_detected}
                onCheckedChange={(v) => set("buy_intent_detected", v || undefined)}
              />
              <Label className="text-xs">Intent de compra</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={filters.has_pitch === true}
                onCheckedChange={(v) => set("has_pitch", v ? true : undefined)}
              />
              <Label className="text-xs">Já recebeu pitch</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Msg nos últimos (dias)</Label>
              <Input
                type="number"
                min={0}
                value={filters.last_message_within_days ?? ""}
                onChange={(e) =>
                  set("last_message_within_days", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </div>
            <div>
              <Label className="text-xs">Inativos há + de (dias)</Label>
              <Input
                type="number"
                min={0}
                value={filters.last_message_older_than_days ?? ""}
                onChange={(e) =>
                  set("last_message_older_than_days", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Comprou o produto</Label>
            <Input
              placeholder="ex.: Curso Alpha"
              value={filters.bought_produto ?? ""}
              onChange={(e) => set("bought_produto", e.target.value || undefined)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={!!filters.never_bought}
              onCheckedChange={(v) => set("never_bought", v || undefined)}
            />
            <Label className="text-xs">Nunca comprou nada</Label>
          </div>

          <div>
            <Label className="text-xs">Busca por nome/telefone</Label>
            <Input
              value={filters.nome_search ?? ""}
              onChange={(e) => set("nome_search", e.target.value || undefined)}
            />
          </div>

          {segments.length > 0 && (
            <div>
              <Label className="text-xs">Excluir contatos do segmento</Label>
              <Select
                value={filters.exclude_segment_id ?? "__none__"}
                onValueChange={(v) => set("exclude_segment_id", v === "__none__" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Preview KPI */}
      <Card className="p-4 bg-secondary/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <div className="text-2xl font-serif">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : count ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">contatos correspondentes</div>
          </div>
          {Object.keys(breakdown).length > 0 && (
            <div className="flex gap-1 ml-4">
              {Object.entries(breakdown).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-xs">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={preview} disabled={loading}>
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll}>
            Limpar
          </Button>
        </div>
      </Card>

      {/* Salvar como segmento */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome do segmento (ex.: Hot sem compra)"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <Button onClick={save} disabled={!saveName.trim() || count === null}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Amostra */}
      {sample.length > 0 && (
        <div>
          <Label className="text-xs">Prévia (até 20)</Label>
          <ScrollArea className="h-40 mt-1 rounded border border-border">
            <div className="p-2 space-y-1">
              {sample.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50">
                  <span className="font-mono w-32 truncate">{r.phone}</span>
                  <span className="flex-1 truncate">{r.contact_name || r.nome || "—"}</span>
                  {r.temperature && (
                    <Badge variant="outline" className="text-[10px]">
                      {r.temperature}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
