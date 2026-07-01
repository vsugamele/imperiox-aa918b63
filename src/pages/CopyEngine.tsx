import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface Prompt {
  id: string;
  intent: string;
  system_prompt: string;
  model: string | null;
  reasoning: string | null;
  output_format: string | null;
  enabled: boolean;
  notes: string | null;
}

export default function CopyEngine() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("imphq_copy_engine_prompts" as any)
        .select("*")
        .order("intent");
      if (error) toast.error(error.message);
      else {
        setPrompts((data || []) as any);
        if (data?.length) setSelectedId((data[0] as any).id);
      }
      setLoading(false);
    })();
  }, []);

  const current = prompts.find((p) => p.id === selectedId) || null;

  const patch = (field: keyof Prompt, value: any) => {
    if (!current) return;
    setPrompts((arr) => arr.map((p) => (p.id === current.id ? { ...p, [field]: value } : p)));
  };

  const save = async () => {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase
      .from("imphq_copy_engine_prompts" as any)
      .update({
        system_prompt: current.system_prompt,
        model: current.model,
        reasoning: current.reasoning,
        output_format: current.output_format,
        enabled: current.enabled,
        notes: current.notes,
      })
      .eq("id", current.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Prompt salvo");
  };

  const runTest = async () => {
    if (!current) return;
    setTesting(true);
    setTestOutput("");
    try {
      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: { intent: current.intent, input: testInput },
      });
      if (error) throw error;
      setTestOutput(data?.content || JSON.stringify(data, null, 2));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando prompts...
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[260px_1fr_400px] gap-4">
      {/* Sidebar */}
      <Card className="bg-secondary/40">
        <CardHeader>
          <CardTitle className="text-sm">Intents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left text-xs px-3 py-2 rounded transition ${
                p.id === selectedId ? "bg-primary/20 text-primary" : "hover:bg-muted/40"
              }`}
            >
              <div className="font-medium">{p.intent}</div>
              <div className="text-[10px] text-muted-foreground">
                {p.model || "—"} · {p.enabled ? "on" : "off"}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="bg-secondary/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> {current?.intent || "—"}
          </CardTitle>
          <Button size="sm" onClick={save} disabled={!current || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {current && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Modelo</Label>
                  <Input
                    value={current.model || ""}
                    onChange={(e) => patch("model", e.target.value)}
                    className="bg-background text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reasoning</Label>
                  <Select
                    value={current.reasoning || "low"}
                    onValueChange={(v) => patch("reasoning", v)}
                  >
                    <SelectTrigger className="bg-background text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">low</SelectItem>
                      <SelectItem value="medium">medium</SelectItem>
                      <SelectItem value="high">high</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Output</Label>
                  <Select
                    value={current.output_format || "text"}
                    onValueChange={(v) => patch("output_format", v)}
                  >
                    <SelectTrigger className="bg-background text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">text</SelectItem>
                      <SelectItem value="json">json</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={current.enabled}
                  onCheckedChange={(v) => patch("enabled", v)}
                />
                <Label className="text-xs">Ativo</Label>
              </div>

              <div>
                <Label className="text-xs">System prompt</Label>
                <Textarea
                  value={current.system_prompt}
                  onChange={(e) => patch("system_prompt", e.target.value)}
                  className="bg-background text-sm min-h-[280px] font-mono leading-6"
                />
              </div>

              <div>
                <Label className="text-xs">Notas internas</Label>
                <Textarea
                  value={current.notes || ""}
                  onChange={(e) => patch("notes", e.target.value)}
                  className="bg-background text-xs min-h-[60px] leading-6"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Playground */}
      <Card className="bg-secondary/40">
        <CardHeader>
          <CardTitle className="text-sm">Playground</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Input de teste..."
            className="bg-background text-sm min-h-[120px] leading-7"
          />
          <Button size="sm" onClick={runTest} disabled={testing || !current} className="w-full gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Rodar
          </Button>
          {testOutput && (
            <pre className="bg-background text-xs p-3 rounded max-h-[400px] overflow-auto whitespace-pre-wrap leading-6">
              {testOutput}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
