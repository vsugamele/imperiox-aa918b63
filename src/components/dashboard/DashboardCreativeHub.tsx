import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sparkles, Compass, ArrowRight, Loader2, Play, CheckCircle, 
  AlertTriangle, Copy, Layers, Target, Eye
} from "lucide-react";
import { toast } from "sonner";

interface Batch {
  id: string;
  nome: string;
  project_id: string;
  status: string;
  total_gerado: number;
  total_planejado: number;
  created_at: string;
}

// Lista rotativa de ângulos diários de elite (7 clássicos + 4 Filemon)
const HOURLY_ANGLES = [
  {
    title: "Identidade: O Incompreendido Esforçado",
    description: "Para quem trabalha duro, mas vê outros levarem o crédito.",
    hookText: "Você sempre foi o que carrega a operação inteira nas costas para outro levar os louros. Já chega disso.",
    themeHook: (kw: string) => `Você que se mata estudando ${kw || "marketing"} enquanto vê quem começou ontem fingindo sucesso...`
  },
  {
    title: "Medo: Arrependimento Futuro",
    description: "Projeta a frustração de continuar na inércia daqui a 5 anos.",
    hookText: "O pior sentimento não é errar. É a dúvida eterna de olhar para trás daqui a 5 anos e pensar: 'e se eu tivesse tentado?'",
    themeHook: (kw: string) => `Imagine acordar em 2031 fazendo as mesmas planilhas de ${kw || "finanças"} e desculpas.`
  },
  {
    title: "Dor: Sintoma Visível (Comportamental)",
    description: "Descreve um hábito físico inegável que revela o problema.",
    hookText: "Você abre o aplicativo do banco, encara o saldo por 2 segundos com o estômago apertado, e fecha rápido para fingir que não viu.",
    themeHook: (kw: string) => `Aquele silêncio constrangedor toda vez que você tenta explicar seu negócio de ${kw || "serviços"} para sua família.`
  },
  {
    title: "Desejo: Liberdade de Escolha",
    description: "Foca no poder de decidir onde estar e o que fazer com autonomia.",
    hookText: "O verdadeiro luxo não é ter relógios caros. É poder acordar em uma terça-feira de sol e decidir passar o dia jogando videogame.",
    themeHook: (kw: string) => `Montar um ecossistema de ${kw || "vendas"} digital que te permite faturar enquanto dorme.`
  },
  {
    title: "Conspiração: A Verdade Que Esconderam",
    description: "Revela o que a indústria/elite não quer que o avatar saiba.",
    hookText: "Tem um motivo pelo qual ninguém da indústria fala sobre isso. E não é o que você pensa.",
    themeHook: (kw: string) => `O que os gurus de ${kw || "marketing"} não te contam — e ganham fortunas justamente por isso.`
  },
  {
    title: "Controvérsia: Contra o Consenso",
    description: "Posiciona-se contra 90% do mercado para polarizar e atrair.",
    hookText: "Vou falar uma coisa que vai irritar 90% dos gurus: o que eles ensinam destrói seu negócio.",
    themeHook: (kw: string) => `Tudo que te ensinaram sobre ${kw || "vendas"} está errado. E eu provo em 3 minutos.`
  },
  {
    title: "História Emocional: O Momento da Virada",
    description: "Narrativa íntima e específica que gera identificação total.",
    hookText: "Era 2 da manhã. Minha filha dormindo no quarto. Eu olhando pro extrato negativo. Foi aí que decidi tudo.",
    themeHook: (kw: string) => `O dia em que eu olhei pro espelho e percebi que ${kw || "tudo"} precisava mudar — e mudou.`
  },
  {
    title: "Promessa: Resultado Específico em Prazo Definido",
    description: "Número grande, prazo curto, garantia agressiva.",
    hookText: "Em 30 dias você vai ter o primeiro resultado concreto — ou eu devolvo cada centavo e ainda pago um café.",
    themeHook: (kw: string) => `Em 30 dias com ${kw || "este método"}: ou você vê o resultado, ou eu te devolvo dobrado.`
  }
];

export function DashboardCreativeHub({ projectId }: { projectId: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  
  // Escolha baseada no dia/hora para rotação determinística
  const dailyAngle = useMemo(() => {
    const day = new Date().getDate();
    return HOURLY_ANGLES[day % HOURLY_ANGLES.length];
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("imphq_creative_batches")
        .select("id, nome, project_id, status, total_gerado, total_planejado, created_at")
        .order("created_at", { ascending: false })
        .limit(3);
      
      if (projectId && projectId !== "all") {
        q = q.eq("project_id", projectId);
      }
      
      const { data } = await q;
      setBatches((data as Batch[]) || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [projectId]);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado com sucesso!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      
      {/* Left panel: Active batches progress */}
      <Card className="lg:col-span-5 border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-serif text-primary flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-primary" />
              Creative Factory Pipelines
            </CardTitle>
            <CardDescription className="text-xs">
              Lotes de criativos de IA gerados recentemente no projeto.
            </CardDescription>
          </div>
          
          <Button variant="ghost" size="icon" onClick={fetchBatches} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 10H18.2" />
            </svg>
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Sparkles className="h-8 w-8 text-muted-foreground/45 mx-auto" />
              <p className="text-xs text-muted-foreground">Nenhum lote de criativos gerado recentemente neste projeto.</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/criativos/novo" className="text-xs">Iniciar Primeiro Lote</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {batches.map((b) => (
                <div key={b.id} className="p-3 rounded-lg border border-border/30 bg-background/40 hover:bg-background/80 transition flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link to={`/criativos/${b.id}`} className="text-xs font-semibold hover:text-primary transition truncate block">
                      {b.nome}
                    </Link>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>Lote: {b.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{new Date(b.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/30">
                      {b.total_gerado}/{b.total_planejado || "?"}
                    </span>
                    
                    <Badge 
                      className={`text-[9px] font-mono capitalize px-2 py-0.5 border ${
                        b.status === "completed" 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : b.status === "failed"
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {b.status === "processing" && <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin inline" />}
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
              
              <Button asChild size="sm" variant="ghost" className="w-full text-[11px] text-primary hover:text-primary/80 gap-1.5 mt-1.5">
                <Link to="/criativos">
                  Ver Todos os Lotes <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right panel: Active psychology angle recommendations */}
      <Card className="lg:col-span-7 border-border/40 bg-gradient-to-br from-primary/5 via-card/85 to-card/95">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold bg-primary/10 border border-primary/20 text-primary rounded px-2.5 py-0.5 uppercase tracking-wider flex items-center gap-1">
              <Compass className="h-3 w-3" /> Ângulo Psicológico de Hoje
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3 text-red-400" /> Conversão Acelerada
            </span>
          </div>
          <CardTitle className="text-base font-serif text-primary mt-2">
            {dailyAngle.title}
          </CardTitle>
          <CardDescription className="text-xs">
            {dailyAngle.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          
          {/* Static Hook Template */}
          <div className="p-3 rounded-lg border border-border/40 bg-background/50 relative group">
            <span className="text-[8px] font-mono font-bold text-muted-foreground uppercase tracking-widest block mb-1">Gancho Universal:</span>
            <p className="italic text-[11px] leading-relaxed pr-8">
              "{dailyAngle.hookText}"
            </p>
            <button 
              onClick={() => copyText(dailyAngle.hookText)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-primary transition opacity-0 group-hover:opacity-100"
              title="Copiar gancho universal"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Interactive headline hook builder */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            <div className="md:col-span-5 space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Personalizar para Tema/Nicho</label>
              <Input 
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ex: emagrecimento, design, dev..."
                className="h-8 text-xs bg-background/40"
              />
            </div>
            
            <div className="md:col-span-7 space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-primary">Headline Customizada Gerada</label>
              <div className="p-2.5 h-8 text-[11px] leading-none flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 relative group truncate">
                <span className="italic select-all">
                  "{dailyAngle.themeHook(keyword)}"
                </span>
                <button 
                  onClick={() => copyText(dailyAngle.themeHook(keyword))}
                  className="text-muted-foreground hover:text-primary transition shrink-0 ml-2"
                  title="Copiar"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button asChild size="sm" className="text-xs gap-1.5 flex-1 shadow-md shadow-primary/5">
              <Link to="/criativos/novo">
                <Sparkles className="h-3.5 w-3.5" /> Iniciar Lote com este Ângulo
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs gap-1.5 flex-1 bg-background/40">
              <Link to="/conteudo-ia">
                <Eye className="h-3.5 w-3.5" /> Escrever Copy no AI Generator
              </Link>
            </Button>
          </div>

        </CardContent>
      </Card>
      
    </div>
  );
}
