import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock, Sparkles, ArrowLeft, FolderOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Step {
  slug: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  output: string;
  error: string | null;
}

interface Run {
  id: string;
  project_id: string;
  status: string;
  steps: Step[];
  current_step: number;
  total_steps: number;
  input: { nome?: string; nicho?: string; url_concorrente?: string };
  error: string | null;
  scraped_context: string | null;
}

export default function AutopilotProgress() {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let mounted = true;

    const fetchRun = async () => {
      const { data } = await (supabase as any)
        .from("imphq_autopilot_runs")
        .select("*")
        .eq("id", runId)
        .maybeSingle();
      if (mounted && data) setRun(data as Run);
    };

    fetchRun();
    const interval = setInterval(() => {
      if (run?.status === "completed" || run?.status === "failed") return;
      fetchRun();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [runId, run?.status]);

  if (!run) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const done = run.steps.filter((s) => s.status === "done").length;
  const failed = run.steps.filter((s) => s.status === "failed").length;
  const pct = Math.round((done / Math.max(run.total_steps, 1)) * 100);

  const statusIcon = (s: Step["status"]) => {
    switch (s) {
      case "done": return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case "running": return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "failed": return <AlertCircle className="h-5 w-5 text-red-400" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/projetos")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Projetos
          </Button>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="h-7 w-7" /> Autopilot
          </h1>
          <p className="text-muted-foreground leading-7">
            {run.input.nome} {run.input.nicho ? `· ${run.input.nicho}` : ""}
          </p>
        </div>
        {run.status === "completed" && (
          <Button asChild>
            <Link to={`/projetos/${projectId}`}>
              <FolderOpen className="h-4 w-4 mr-1" /> Abrir Projeto
            </Link>
          </Button>
        )}
      </div>

      <Card className="bg-secondary/40 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display">Progresso</CardTitle>
            <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
              {run.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {run.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{done}/{run.total_steps} concluídos {failed > 0 && `· ${failed} falharam`}</span>
            <span>{pct}%</span>
          </div>
          {run.error && (
            <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded border border-red-500/20">
              {run.error}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {run.steps.map((step) => (
          <Card key={step.slug} className="bg-secondary/40 border-border overflow-hidden">
            <button
              onClick={() => setOpenStep(openStep === step.slug ? null : step.slug)}
              className="w-full p-4 flex items-center gap-3 hover:bg-secondary/60 transition-colors text-left"
            >
              {statusIcon(step.status)}
              <div className="flex-1">
                <div className="font-medium">{step.label}</div>
                <div className="text-xs text-muted-foreground">{step.slug}</div>
              </div>
              {step.status === "done" && (
                <span className="text-xs text-muted-foreground">{step.output.length.toLocaleString()} chars</span>
              )}
            </button>

            {openStep === step.slug && step.output && (
              <div className="px-6 pb-6 border-t border-border">
                <div className="prose prose-sm prose-invert max-w-none leading-7 pt-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.output}</ReactMarkdown>
                </div>
              </div>
            )}
            {openStep === step.slug && step.error && (
              <div className="px-6 pb-4 text-sm text-red-400">{step.error}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
