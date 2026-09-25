import { useState, useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Terminal, Bot, Sparkles, Code2, ExternalLink, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Tables<"imphq_projects">;
}

export function ProjetoMcpDialog({ open, onOpenChange, project }: Props) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://tkbivipqiewkfnhktmqq.supabase.co";
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const projectId = project.id;

  const projectData = jsonFields(project.data);
  const avatarData = jsonFields(project.avatar);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopiedSection(null), 2500);
  };

  // ── 1. Snippet JSON do MCP para Claude Desktop / Cursor ──
  const mcpConfigJson = useMemo(() => {
    return JSON.stringify(
      {
        mcpServers: {
          [`imperio-${projectId}`]: {
            command: "npx",
            args: [
              "-y",
              "mcp-remote",
              `${supabaseUrl}/functions/v1/project-mcp`,
              "--header",
              `apikey: ${supabaseKey}`,
              "--header",
              `x-project-id: ${projectId}`,
            ],
          },
        },
      },
      null,
      2
    );
  }, [supabaseUrl, supabaseKey, projectId]);

  // ── 2. Dossiê Markdown Mestre para colar em qualquer IA ──
  const masterPromptMarkdown = useMemo(() => {
    const produtos = Array.isArray(projectData.produtos) ? projectData.produtos : [];
    const prodList = produtos.length > 0
      ? produtos.map((p: any) => `- **${p.nome || p.name}**: R$ ${p.preco || p.price || "—"} | Tipo: ${p.tipo || "principal"} | Checkout: ${p.checkout_url || p.link || "Sem link"}`).join("\n")
      : "Nenhum produto cadastrado no briefing.";

    return `# DOSSIÊ EXECUTIVO DE OPERAÇÃO: ${project.name.toUpperCase()} (ID: ${project.id})
Você é o estrategista chefe e operador deste projeto na plataforma Império Digital.
Use todas as informações abaixo para criar copies, analisar funis, ajustar automações e tomar decisões:

## 1. DADOS GERAIS
- **Nome do Projeto:** ${project.name}
- **Categoria / Nicho:** ${project.category || "Não informado"}
- **Descrição da Operação:** ${project.description || "Não informada"}
- **Status do Projeto:** ${jsonText(projectData.status) || "Em andamento"}

## 2. AVATAR & PSICOLOGIA SUBCONSCIENTE
- **Perfil do Avatar:** ${avatarData.nome || avatarData.name || avatarData.perfil || "Não especificado"}
- **Dores Críticas:** ${JSON.stringify(avatarData.dores || avatarData.pain_points || "Não mapeadas")}
- **Desejos Profundos / Proibidos:** ${JSON.stringify(avatarData.desejos || avatarData.desejos_proibidos || "Não mapeados")}
- **Crenças e Ceticismo:** ${JSON.stringify(avatarData.crencas || avatarData.objecoes || "Não mapeadas")}

## 3. MECANISMO ÚNICO & TESE
${projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || "Mecanismo Único ainda em fase de definição."}

## 4. ESTEIRA DE PRODUTOS & CHECKOUTS
${prodList}

## 5. REGRAS DE CONVERSÃO X1 (WHATSAPP / INSTAGRAM)
- Conversão 100% autônoma pela IA com foco em diagnosticar a dor antes de falar de produto.
- Nunca transparecer que é um bot e nunca admitir ser IA.
- Se o cliente apresentar atrito ou reclamar, desescalar com empatia extrema sem transferir para humanos.
`;
  }, [project, projectData, avatarData]);

  // ── 3. Exemplos de chamadas cURL e Scripts ──
  const curlExample = useMemo(() => {
    return `# 1. Puxar dossiê completo do projeto via GET
curl -X GET "${supabaseUrl}/functions/v1/project-mcp?project_id=${projectId}&action=context" \\
  -H "apikey: ${supabaseKey}"

# 2. Puxar métricas de hoje via MCP Tool Call (POST)
curl -X POST "${supabaseUrl}/functions/v1/project-mcp" \\
  -H "apikey: ${supabaseKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "get_project_metrics",
      "arguments": { "project_id": "${projectId}" }
    }
  }'
`;
  }, [supabaseUrl, supabaseKey, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#0E1013] border-[#1B1E23] text-foreground p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[#1B1E23] bg-gradient-to-r from-primary/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Conectar IA & MCP do Projeto
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-mono">
                  {project.id}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Permita que seu sócio ou sua IA externa (Claude, Cursor, ChatGPT, Agentes) acesse e atualize este projeto.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="mcp" className="w-full">
          <div className="px-6 pt-3 border-b border-[#1B1E23] bg-[#0A0B0D]">
            <TabsList className="bg-secondary/40 border border-border/50 h-9 p-0.5">
              <TabsTrigger value="mcp" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-black">
                <Zap className="h-3.5 w-3.5" /> MCP (Claude & Cursor)
              </TabsTrigger>
              <TabsTrigger value="prompt" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-black">
                <Sparkles className="h-3.5 w-3.5" /> Prompt Mestre para IA
              </TabsTrigger>
              <TabsTrigger value="api" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-black">
                <Terminal className="h-3.5 w-3.5" /> API REST & cURL
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ───────── ABA 1: MCP CLAUDE & CURSOR ───────── */}
          <TabsContent value="mcp" className="p-6 space-y-4 focus:outline-none">
            <div className="bg-[#121418] border border-[#22262E] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-mono font-semibold uppercase text-emerald-400">
                    Configuração MCP Pronta
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(mcpConfigJson, "mcp")}
                  className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs h-7 gap-1.5"
                >
                  {copiedSection === "mcp" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedSection === "mcp" ? "Copiado!" : "Copiar Configuração MCP"}
                </Button>
              </div>

              <pre className="bg-black/60 border border-white/5 rounded-lg p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48 leading-relaxed">
                {mcpConfigJson}
              </pre>

              <div className="text-[11px] text-muted-foreground space-y-1.5 pt-1">
                <p>
                  <strong>Como usar no Claude Desktop:</strong> Cole o bloco acima no seu arquivo{" "}
                  <code className="text-primary font-mono bg-black/40 px-1 py-0.5 rounded">claude_desktop_config.json</code>.
                </p>
                <p>
                  <strong>Como usar no Cursor:</strong> Vá em <em>Settings &gt; MCP &gt; Add Server</em> e use o comando acima.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ferramentas que sua IA poderá chamar:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Card className="bg-[#121418] border-[#22262E] p-2.5">
                  <p className="font-mono text-primary font-semibold">get_project_context</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Puxa avatar, mecanismo único, produtos e checkouts.</p>
                </Card>
                <Card className="bg-[#121418] border-[#22262E] p-2.5">
                  <p className="font-mono text-primary font-semibold">get_project_metrics</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Puxa leads hoje, vendas, faturamento e status WhatsApp.</p>
                </Card>
                <Card className="bg-[#121418] border-[#22262E] p-2.5">
                  <p className="font-mono text-primary font-semibold">get_project_leads</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Lista leads quentes e conversas prioritárias.</p>
                </Card>
                <Card className="bg-[#121418] border-[#22262E] p-2.5">
                  <p className="font-mono text-primary font-semibold">update_project_layer</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Permite a IA salvar copy, avatar ou notas direto no banco.</p>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ───────── ABA 2: PROMPT MESTRE PARA CHATS ───────── */}
          <TabsContent value="prompt" className="p-6 space-y-4 focus:outline-none">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Dossiê Completo Formatado</h4>
                <p className="text-xs text-muted-foreground">
                  Copie e cole no ChatGPT, Claude, Gemini ou DeepSeek para dar contexto 100% preciso.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => copyToClipboard(masterPromptMarkdown, "prompt")}
                className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs h-8 gap-1.5"
              >
                {copiedSection === "prompt" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSection === "prompt" ? "Copiado!" : "Copiar Dossiê Completo"}
              </Button>
            </div>

            <div className="bg-black/60 border border-[#22262E] rounded-xl p-4 max-h-72 overflow-y-auto">
              <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {masterPromptMarkdown}
              </pre>
            </div>
          </TabsContent>

          {/* ───────── ABA 3: API REST & CURL ───────── */}
          <TabsContent value="api" className="p-6 space-y-4 focus:outline-none">
            <div className="bg-[#121418] border border-[#22262E] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-zinc-300">
                  Exemplo de cURL para Scripts Externos
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(curlExample, "curl")}
                  className="h-7 text-xs border-border/60 gap-1.5"
                >
                  {copiedSection === "curl" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copiar cURL
                </Button>
              </div>
              <pre className="bg-black/60 border border-white/5 rounded-lg p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-56 leading-relaxed">
                {curlExample}
              </pre>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Autenticação Segura</p>
                <p className="text-[11px] mt-0.5">
                  Seu sócio pode usar a chave anon pública do Supabase configurada como header <code className="text-primary font-mono">apikey</code> ou uma Service Role para operações de escrita avançadas.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
