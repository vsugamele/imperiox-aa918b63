import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, AlertTriangle, Video } from "lucide-react";

type Job = {
  id: string;
  produto: string;
  status: string;
  current_step: string | null;
  script_json: any;
  casting_json: any;
  gate_errors: any;
  created_at: string;
};

export default function UgcAdFactory() {
  const [produto, setProduto] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [age, setAge] = useState("26-35");
  const [tone, setTone] = useState("confessional");
  const [lane, setLane] = useState("pain");
  const [research, setResearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [current, setCurrent] = useState<Job | null>(null);

  async function load() {
    const { data } = await supabase
      .from("imphq_ugc_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function createJob() {
    if (!produto.trim()) return toast.error("Informe o produto");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Faça login");
    const { data, error } = await supabase.from("imphq_ugc_jobs").insert({
      project_id: "default",
      produto,
      actor_ref_url: refUrl || null,
      age_bracket: age,
      tone,
      lane,
      research_leads: research || null,
      status: "gating",
    }).select().single();
    if (error) return toast.error(error.message);
    setCurrent(data as any);
    await load();
    return data as any;
  }

  async function runStep(step: "script" | "casting", job: Job) {
    setLoading(step);
    const payload: any = {
      job_id: job.id,
      produto: job.produto,
      age_bracket: age, tone, lane,
      research_leads: research,
      actor_ref_url: refUrl,
    };
    if (step === "casting") payload.script = job.script_json;
    const { data, error } = await supabase.functions.invoke("ugc-pipeline", {
      body: payload,
      // step goes as query param
      // @ts-ignore
      queryParams: { step },
    } as any);
    // fallback for SDKs that don't pass query params:
    let result = data;
    if (!result) {
      const url = `${(supabase as any).functions.url}/ugc-pipeline?step=${step}`;
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      });
      result = await r.json();
    }
    setLoading(null);
    if (result?.error) {
      toast.error(`Gate falhou (${step})`, { description: (result.errors || []).slice(0, 3).join(" · ") });
      await supabase.from("imphq_ugc_jobs").update({ gate_errors: result.errors ?? [], status: "gate_failed" }).eq("id", job.id);
    } else {
      toast.success(`${step} aprovado`);
    }
    await load();
    const { data: fresh } = await supabase.from("imphq_ugc_jobs").select("*").eq("id", job.id).single();
    setCurrent(fresh as any);
  }

  async function runAll() {
    const job = await createJob();
    if (!job) return;
    await runStep("script", job);
    const { data: after1 } = await supabase.from("imphq_ugc_jobs").select("*").eq("id", job.id).single();
    if ((after1 as any)?.script_json) await runStep("casting", after1 as any);
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Video className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-serif text-3xl">Omni UGC Ad Factory</h1>
          <p className="text-sm text-muted-foreground">Produto + referência → talking-head 9:16 ~20s. Gate-driven, sem prompt manual.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Briefing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Produto</Label>
              <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="ex: Curso de X, suplemento Y" />
            </div>
            <div>
              <Label>Foto de referência do ator (URL opcional)</Label>
              <Input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Idade</Label>
                <Select value={age} onValueChange={setAge}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["18-25","26-35","36-45","46-60","60+"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tom</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["confessional","urgent","casual","expert"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lane</Label>
                <Select value={lane} onValueChange={setLane}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pain","desire","curiosity","contrarian"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Research / insights (opcional)</Label>
              <Textarea value={research} onChange={(e) => setResearch(e.target.value)} rows={3} placeholder="Colar avatar, dores, objeções, frases do público…" />
            </div>
            <Button onClick={runAll} disabled={!!loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {loading}…</> : <><Sparkles className="h-4 w-4 mr-2" /> Rodar gates (script + casting)</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Job atual</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!current && <p className="text-sm text-muted-foreground">Sem job selecionado.</p>}
            {current && (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{current.status}</Badge>
                  {current.current_step && <Badge>{current.current_step}</Badge>}
                </div>
                {Array.isArray(current.gate_errors) && current.gate_errors.length > 0 && (
                  <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs">
                    <div className="flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" /> Gate errors</div>
                    <ul className="list-disc pl-4">{current.gate_errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
                {current.script_json && (
                  <details className="text-xs">
                    <summary className="cursor-pointer flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary" /> script_json</summary>
                    <pre className="mt-2 max-h-48 overflow-auto bg-secondary/40 p-2 rounded">{JSON.stringify(current.script_json, null, 2)}</pre>
                  </details>
                )}
                {current.casting_json && (
                  <details className="text-xs">
                    <summary className="cursor-pointer flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary" /> casting_json</summary>
                    <pre className="mt-2 max-h-48 overflow-auto bg-secondary/40 p-2 rounded">{JSON.stringify(current.casting_json, null, 2)}</pre>
                  </details>
                )}
                <p className="text-xs text-muted-foreground leading-6">
                  Próximos passos (clip1 → clip2 com seed do último frame → stitch 9:16) exigem connector Replicate/Veo — não incluído nesta fase.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Jobs recentes</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum job ainda.</p>}
          <div className="space-y-2">
            {jobs.map(j => (
              <button key={j.id} onClick={() => setCurrent(j)} className="w-full text-left flex items-center justify-between rounded border border-border p-3 hover:bg-secondary/40">
                <div>
                  <div className="text-sm font-medium">{j.produto}</div>
                  <div className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{j.status}</Badge>
                  {j.current_step && <Badge>{j.current_step}</Badge>}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
