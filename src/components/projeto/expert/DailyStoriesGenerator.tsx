import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Plus, Copy, Wand2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, getDay } from "date-fns";

interface StoryIdea {
  hook: string;
  tensao: string;
  cta: string;
  formato: string;
  gatilho_origem: string;
  duracao_segundos: number;
}

interface Props {
  projectId: string;
  onAddToToday?: (story: StoryIdea) => Promise<void> | void;
}

const DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const FORMATO_BADGE: Record<string, string> = {
  narrativo: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  enquete: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  caixa_pergunta: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  depoimento: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  polemica: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export function DailyStoriesGenerator({ projectId, onAddToToday }: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"daily" | "bastidor">("daily");
  const [customEvent, setCustomEvent] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [stories, setStories] = useState<StoryIdea[]>([]);
  const [resumo, setResumo] = useState("");
  const [contexto, setContexto] = useState<any>(null);

  async function generate() {
    if (!projectId) {
      toast.error("Selecione um projeto");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-stories-ideas", {
        body: {
          project_id: projectId,
          mode,
          custom_event: showCustom ? customEvent : "",
        },
      });
      if (error) throw error;
      setStories(data?.stories || []);
      setResumo(data?.resumo_contexto || "");
      setContexto(data?.contexto_usado || null);
      if ((data?.stories || []).length === 0) {
        toast.info("IA não retornou ideias — tente novamente.");
      } else {
        toast.success(`${data.stories.length} stories gerados!`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar stories");
    } finally {
      setLoading(false);
    }
  }

  async function copyStory(s: StoryIdea) {
    const text = `🎬 HOOK (${s.duracao_segundos}s)\n${s.hook}\n\n📌 TENSÃO\n${s.tensao}\n\n🔥 CTA\n${s.cta}`;
    await navigator.clipboard.writeText(text);
    toast.success("Story copiado!");
  }

  async function addToToday(story: StoryIdea) {
    try {
      const today = new Date();
      const day = DAYS[getDay(today)];
      // Log usage to avoid repetition next time
      await supabase.from("imphq_expert_logs" as any).insert({
        project_id: projectId,
        content_id: `daily-story-${Date.now()}`,
        week: "semana_1",
        day,
        action: "story_idea_used",
        metadata: {
          hook: story.hook,
          tensao: story.tensao,
          cta: story.cta,
          formato: story.formato,
          gatilho_origem: story.gatilho_origem,
          duracao_segundos: story.duracao_segundos,
          generated_at: today.toISOString(),
        },
      });
      if (onAddToToday) {
        await onAddToToday(story);
      }
      toast.success(`Story adicionado ao plano de ${format(today, "dd/MM")}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao adicionar");
    }
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ideias de Stories pra Hoje
            <Badge variant="outline" className="text-[10px] ml-1">IA contextual</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border bg-background overflow-hidden text-xs">
              <button
                onClick={() => setMode("daily")}
                className={`px-3 py-1.5 transition ${mode === "daily" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Diário
              </button>
              <button
                onClick={() => setMode("bastidor")}
                className={`px-3 py-1.5 transition ${mode === "bastidor" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Bastidor
              </button>
            </div>
            <Button size="sm" onClick={generate} disabled={loading} className="gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {stories.length > 0 ? "Regerar" : "Gerar 5 ideias"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {showCustom ? "− esconder evento de hoje" : "+ adicionar evento de hoje (opcional)"}
          </button>
          {contexto && (
            <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              {contexto.dores > 0 && <Badge variant="outline" className="text-[10px]">{contexto.dores} dores</Badge>}
              {contexto.vendas_24h > 0 && <Badge variant="outline" className="text-[10px]">{contexto.vendas_24h} vendas 24h</Badge>}
              {contexto.leads_quentes > 0 && <Badge variant="outline" className="text-[10px]">{contexto.leads_quentes} leads quentes</Badge>}
              {contexto.stories_evitados > 0 && <Badge variant="outline" className="text-[10px]">evitando {contexto.stories_evitados} repetições</Badge>}
            </div>
          )}
        </div>

        {showCustom && (
          <Textarea
            value={customEvent}
            onChange={(e) => setCustomEvent(e.target.value)}
            placeholder="Ex: acabei de fechar 3 vendas em 1h / aluno enviou print da transformação / encontrei objeção nova nos comentários…"
            rows={2}
            className="text-sm"
          />
        )}

        {resumo && (
          <div className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
            {resumo}
          </div>
        )}

        {stories.length === 0 && !loading && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Clique em "Gerar 5 ideias" — a IA usa Avatar, vendas das últimas 24h, leads quentes e evita repetir o que já saiu.
          </div>
        )}

        <div className="space-y-2">
          {stories.map((s, i) => (
            <Card key={i} className="bg-background border-border hover:border-primary/40 transition-colors">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge className={`text-[10px] ${FORMATO_BADGE[s.formato] || ""}`} variant="outline">
                      {s.formato}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{s.duracao_segundos}s</Badge>
                    <Badge variant="secondary" className="text-[10px]">{s.gatilho_origem}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyStory(s)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => addToToday(s)}>
                      <Plus className="h-3 w-3" /> Hoje
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div>
                    <span className="text-[10px] uppercase text-primary font-semibold">Hook</span>
                    <p className="font-medium">{s.hook}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">Tensão</span>
                    <p className="text-muted-foreground">{s.tensao}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-primary font-semibold">CTA</span>
                    <p className="text-primary/90">{s.cta}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
