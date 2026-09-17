import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, Sparkles, Activity } from "lucide-react";

const AISaude = lazy(() => import("./AISaude"));
const AILearning = lazy(() => import("./AILearning"));
const SaudeProdutos = lazy(() => import("./SaudeProdutos"));

const VALID = ["saude", "memoria", "produtos"] as const;
type Tab = (typeof VALID)[number];

export default function InteligenciaIA() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && VALID.includes(raw) ? raw : "saude";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-serif text-primary">🧠 Inteligência IA</h1>
        <p className="text-sm text-muted-foreground">
          Saúde da IA, Memória Viva e Saúde dos Produtos em um só lugar.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="saude" className="gap-2">
            <Sparkles className="h-4 w-4" /> Saúde da IA
          </TabsTrigger>
          <TabsTrigger value="memoria" className="gap-2">
            <Brain className="h-4 w-4" /> Memória Viva
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2">
            <Activity className="h-4 w-4" /> Saúde dos Produtos
          </TabsTrigger>
        </TabsList>

        <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando…</div>}>
          <TabsContent value="saude" className="mt-4">
            <AISaude />
          </TabsContent>
          <TabsContent value="memoria" className="mt-4">
            <AILearning />
          </TabsContent>
          <TabsContent value="produtos" className="mt-4">
            <SaudeProdutos />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
