import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const ANGULOS = [
  { value: "dor", label: "Dor" },
  { value: "desejo", label: "Desejo / Transformação" },
  { value: "prova", label: "Prova Social" },
  { value: "autoridade", label: "Autoridade" },
  { value: "curiosidade", label: "Curiosidade" },
  { value: "antes-depois", label: "Antes vs Depois" },
  { value: "objecao", label: "Objeção Destruída" },
];

interface Projeto {
  id: string;
  nome: string;
}

export default function CriativoNovo() {
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);

  const [projectId, setProjectId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [produto, setProduto] = useState("");
  const [publico, setPublico] = useState("");
  const [dor, setDor] = useState("");
  const [desejo, setDesejo] = useState("");
  const [mecanismo, setMecanismo] = useState("");
  const [extras, setExtras] = useState("");
  const [formato, setFormato] = useState("1:1");
  const [variacoes, setVariacoes] = useState(2);
  const [angulos, setAngulos] = useState<string[]>(["dor", "desejo", "prova", "curiosidade"]);
  const [referenciasText, setReferenciasText] = useState("");
  const [expertFotos, setExpertFotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, nome")
        .order("nome", { ascending: true });
      setProjetos((data as Projeto[]) || []);
    })();
  }, []);

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        toast.error("Faça login");
        return;
      }
      const uploaded: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${uid}/expert-fotos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("creative-assets").upload(path, f);
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data } = supabase.storage.from("creative-assets").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setExpertFotos((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  function toggleAngulo(a: string) {
    setAngulos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function handleSubmit() {
    if (!projectId) return toast.error("Selecione um projeto");
    if (!produto.trim()) return toast.error("Descreva o produto");
    if (angulos.length === 0) return toast.error("Escolha pelo menos 1 ângulo");

    setLoading(true);
    try {
      const referencias_urls = referenciasText
        .split(/\s+/)
        .filter((s) => s.startsWith("http"))
        .slice(0, 3);

      const { data, error } = await supabase.functions.invoke("creative-factory", {
        body: {
          project_id: projectId,
          nome: nome || `${produto} — ${new Date().toLocaleDateString("pt-BR")}`,
          briefing: {
            produto,
            publico,
            dor,
            desejo,
            mecanismo,
            extras,
            variacoes_por_angulo: variacoes,
          },
          referencias_urls,
          expert_fotos: expertFotos,
          angulos,
          formato,
        },
      });
      if (error) throw error;
      toast.success("Geração iniciada! Acompanhe em tempo real.");
      navigate(`/criativos/${(data as any).batch_id}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao iniciar");
    } finally {
      setLoading(false);
    }
  }

  const total = angulos.length * variacoes;
  const custoEstimado = (total * 0.04).toFixed(2);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-primary flex items-center gap-2">
          <Sparkles className="h-7 w-7" /> Novo batch de criativos
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure o briefing e deixe a IA gerar {total} imagens em múltiplos ângulos.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <Label>Projeto *</Label>
          <Select value={projectId || undefined} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Nome do batch (opcional)</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lançamento Black Friday" />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">Briefing</h3>
        <div>
          <Label>Produto / Oferta *</Label>
          <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex: Curso Método X" />
        </div>
        <div>
          <Label>Público-alvo</Label>
          <Input value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ex: Mulheres 30-45 empreendedoras" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Dor principal</Label>
            <Textarea value={dor} onChange={(e) => setDor(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Desejo / Transformação</Label>
            <Textarea value={desejo} onChange={(e) => setDesejo(e.target.value)} rows={2} />
          </div>
        </div>
        <div>
          <Label>Mecanismo único (como funciona)</Label>
          <Textarea value={mecanismo} onChange={(e) => setMecanismo(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Direções extras (estilo, cores, elementos)</Label>
          <Textarea value={extras} onChange={(e) => setExtras(e.target.value)} rows={2} placeholder="Ex: paleta dourada, estilo editorial, fundo luxo" />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">Fotos do expert (opcional)</h3>
        <p className="text-sm text-muted-foreground">
          A IA usará estas fotos como referência visual da pessoa nas imagens geradas.
        </p>
        <input type="file" multiple accept="image/*" onChange={handleFotoUpload} disabled={uploading} />
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
        {expertFotos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {expertFotos.map((url, i) => (
              <div key={i} className="relative aspect-square">
                <img src={url} alt="" className="w-full h-full object-cover rounded" />
                <button
                  onClick={() => setExpertFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">Ângulos e formato</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ANGULOS.map((a) => (
            <label
              key={a.value}
              className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent/50"
            >
              <Checkbox checked={angulos.includes(a.value)} onCheckedChange={() => toggleAngulo(a.value)} />
              <span className="text-sm">{a.label}</span>
            </label>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Formato</Label>
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1 Quadrado (Feed)</SelectItem>
                <SelectItem value="4:5">4:5 Retrato (Feed)</SelectItem>
                <SelectItem value="9:16">9:16 Stories/Reels</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Variações por ângulo</Label>
            <Select value={String(variacoes)} onValueChange={(v) => setVariacoes(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-medium">Referências (opcional)</h3>
        <p className="text-sm text-muted-foreground">
          Cole até 3 URLs de anúncios concorrentes. A IA fará scrape e se inspirará sem copiar.
        </p>
        <Textarea
          value={referenciasText}
          onChange={(e) => setReferenciasText(e.target.value)}
          rows={3}
          placeholder="https://exemplo.com/anuncio1&#10;https://exemplo.com/anuncio2"
        />
      </Card>

      <div className="sticky bottom-4 bg-background/90 backdrop-blur border rounded-lg p-4 flex items-center justify-between">
        <div className="text-sm">
          <div>
            <span className="font-medium">{total}</span> imagens serão geradas
          </div>
          <div className="text-xs text-muted-foreground">Custo estimado: ~${custoEstimado}</div>
        </div>
        <Button onClick={handleSubmit} disabled={loading} size="lg">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Gerar criativos
        </Button>
      </div>
    </div>
  );
}
