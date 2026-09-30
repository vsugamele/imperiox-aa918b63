import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Smartphone,
  KeyRound,
  Package,
  Instagram,
  Plus,
  Pencil,
  Copy,
  ExternalLink,
  ShieldCheck,
  Bot,
  Zap,
  Globe,
  ShoppingCart,
  Layers,
  MapPinPlus,
  RefreshCw,
  Search,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapId?: string | null;
  onNodeInjected?: () => void;
}

interface CloudPhone {
  id: string;
  nome: string;
  provider: string;
  device_id: string;
  proxy_geo: string | null;
  status: string;
  project_id: string | null;
  notas: string | null;
}

interface PerfilEmpresa {
  id: string;
  nome: string;
  tipo: string;
  warmup_status: string | null;
  seguidores: number | null;
  cloud_phone_provider: string | null;
  project_id: string | null;
  extra?: any;
}

interface VaultTool {
  id: string;
  name: string;
  url: string | null;
  username: string | null;
  password_encrypted: string | null;
  category: string | null;
  notes: string | null;
  project_id: string | null;
  produto: string | null;
}

export function CompanyInfraToolsModal({ open, onOpenChange, mapId, onNodeInjected }: Props) {
  const [activeTab, setActiveTab] = useState("geelark");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dados
  const [phones, setPhones] = useState<CloudPhone[]>([]);
  const [perfis, setPerfis] = useState<PerfilEmpresa[]>([]);
  const [tools, setTools] = useState<VaultTool[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Modal de Edição de Acesso / Ferramenta
  const [editingTool, setEditingTool] = useState<Partial<VaultTool> | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [savingTool, setSavingTool] = useState(false);

  // Modal de Edição de Perfil GeeLark
  const [editingPerfil, setEditingPerfil] = useState<Partial<PerfilEmpresa> | null>(null);
  const [savingPerfil, setSavingPerfil] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [phonesRes, perfisRes, toolsRes, projectsRes] = await Promise.all([
        supabase.from("imphq_cloud_phones").select("*").order("nome", { ascending: true }),
        supabase.from("imphq_empresa").select("*").order("created_at", { ascending: false }),
        supabase.from("imphq_tools_vault").select("*").order("name", { ascending: true }),
        supabase.from("imphq_projects").select("id, name, category, data").order("name", { ascending: true }),
      ]);

      setPhones((phonesRes.data || []) as CloudPhone[]);
      setPerfis((perfisRes.data || []) as PerfilEmpresa[]);
      setTools((toolsRes.data || []) as VaultTool[]);
      setProjects(projectsRes.data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar infraestrutura: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Injetar Nó no Mapa Atual
  const handleInjectNode = async (
    label: string,
    kind: string,
    color: string,
    description: string,
    apiBinding?: any,
    stageRole?: string
  ) => {
    if (!mapId) {
      toast.error("Nenhum mapa selecionado no momento");
      return;
    }

    try {
      // Posição no centro do canvas
      const x = Math.floor(Math.random() * 300) + 150;
      const y = Math.floor(Math.random() * 300) + 150;

      const payload = {
        map_id: mapId,
        label,
        kind,
        color,
        description,
        position: { x, y },
        size: "M",
        stage_role: stageRole || "Infra & Acesso",
        executor_type: "EXTERNAL_TOOL",
        api_binding: apiBinding || null,
      };

      const { error } = await supabase.from("imphq_company_map_nodes").insert(payload);
      if (error) throw error;

      toast.success(`Nó "${label}" adicionado ao mapa visual!`);
      if (onNodeInjected) onNodeInjected();
    } catch (err: any) {
      toast.error("Erro ao adicionar nó: " + (err.message || err));
    }
  };

  // Salvar Ferramenta / Acesso
  const handleSaveTool = async () => {
    if (!editingTool || !editingTool.name) {
      toast.error("O nome da ferramenta é obrigatório");
      return;
    }

    setSavingTool(true);
    try {
      const payload: any = {
        name: editingTool.name,
        url: editingTool.url || null,
        username: editingTool.username || null,
        password_encrypted: editingTool.password_encrypted || null,
        category: editingTool.category || "geral",
        notes: editingTool.notes || null,
        project_id: editingTool.project_id || null,
        produto: editingTool.produto || null,
      };

      if (editingTool.id) {
        const { error } = await supabase.from("imphq_tools_vault").update(payload).eq("id", editingTool.id);
        if (error) throw error;
        toast.success("Credencial atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("imphq_tools_vault").insert(payload);
        if (error) throw error;
        toast.success("Nova ferramenta cadastrada no cofre!");
      }

      setEditingTool(null);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao salvar ferramenta: " + (err.message || err));
    } finally {
      setSavingTool(false);
    }
  };

  // Salvar Perfil / Conta
  const handleSavePerfil = async () => {
    if (!editingPerfil || !editingPerfil.nome) {
      toast.error("O nome do perfil é obrigatório");
      return;
    }

    setSavingPerfil(true);
    try {
      const payload: any = {
        nome: editingPerfil.nome,
        tipo: editingPerfil.tipo || "instagram",
        warmup_status: editingPerfil.warmup_status || "aquecendo",
        seguidores: editingPerfil.seguidores || 0,
        cloud_phone_provider: editingPerfil.cloud_phone_provider || "geelark",
        project_id: editingPerfil.project_id || null,
        extra: editingPerfil.extra || {},
      };

      if (editingPerfil.id) {
        const { error } = await supabase.from("imphq_empresa").update(payload).eq("id", editingPerfil.id);
        if (error) throw error;
        toast.success("Perfil atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("imphq_empresa").insert(payload);
        if (error) throw error;
        toast.success("Novo perfil adicionado!");
      }

      setEditingPerfil(null);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao salvar perfil: " + (err.message || err));
    } finally {
      setSavingPerfil(false);
    }
  };

  // Filtragem
  const filteredPhones = useMemo(() => {
    return phones.filter(p => p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || p.device_id.includes(searchQuery));
  }, [phones, searchQuery]);

  const filteredPerfis = useMemo(() => {
    return perfis.filter(p => p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || p.tipo.toLowerCase().includes(searchQuery));
  }, [perfis, searchQuery]);

  const filteredTools = useMemo(() => {
    return tools.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.category || "").toLowerCase().includes(searchQuery));
  }, [tools, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#0A0B0D] border-[#1B1E23] text-white p-6 overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b border-[#1B1E23]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white">
                  Infraestrutura, GeeLark & Central de Acessos
                </DialogTitle>
                <DialogDescription className="text-xs text-[#8A8F98]">
                  Visualize o ecossistema completo, ajuste acessos de ferramentas e injete qualquer ativo no mapa visual.
                </DialogDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="h-7 text-xs border-[#1B1E23] text-[#8A8F98] hover:text-white"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </DialogHeader>

        {/* Barra de Busca Rápida */}
        <div className="py-2.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8A8F98]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar aparelho GeeLark, perfil de Instagram, ferramenta ou produto..."
              className="h-8 pl-8 text-xs bg-[#0E1013] border-[#1B1E23] text-white placeholder:text-[#8A8F98]/50"
            />
          </div>
        </div>

        {/* Abas Principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-[#0E1013] border border-[#1B1E23] p-1 h-9 justify-start gap-1">
            <TabsTrigger value="geelark" className="text-xs h-7 gap-1.5 data-[state=active]:bg-[#1B1E23] data-[state=active]:text-white">
              <Smartphone className="h-3.5 w-3.5 text-cyan-400" /> GeeLark & Perfis ({phones.length} Aparelhos · {perfis.length} Contas)
            </TabsTrigger>
            <TabsTrigger value="ferramentas" className="text-xs h-7 gap-1.5 data-[state=active]:bg-[#1B1E23] data-[state=active]:text-white">
              <KeyRound className="h-3.5 w-3.5 text-amber-400" /> Ferramentas & Acessos ({tools.length})
            </TabsTrigger>
            <TabsTrigger value="produtos" className="text-xs h-7 gap-1.5 data-[state=active]:bg-[#1B1E23] data-[state=active]:text-white">
              <Package className="h-3.5 w-3.5 text-[#D6FF4B]" /> Projetos & Produtos ({projects.length})
            </TabsTrigger>
          </TabsList>

          {/* ======================================================== */}
          {/* TAB 1: GEELARK & PERFIS DE REDES SOCIAIS                */}
          {/* ======================================================== */}
          <TabsContent value="geelark" className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
            {/* Bloco de Aparelhos GeeLark */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-cyan-400" /> Aparelhos em Nuvem (Cloud Phones):
                </span>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px] font-mono">
                  {phones.length} Dispositivos Ativos
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredPhones.map((phone) => (
                  <div key={phone.id} className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23] space-y-2 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
                          {phone.nome}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">GeeLark #{phone.nome}</div>
                          <div className="text-[10px] font-mono text-[#8A8F98]">ID: {phone.device_id}</div>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono">
                        ● {phone.status || "Ativo"}
                      </Badge>
                    </div>

                    <div className="text-[10px] text-[#8A8F98] space-y-0.5">
                      <div>Proxy: <span className="font-mono text-zinc-300">{phone.proxy_geo || "Proxy Residencial Automático"}</span></div>
                      <div>Provedor: <span className="capitalize text-zinc-300">{phone.provider}</span></div>
                    </div>

                    <div className="pt-2 border-t border-[#1B1E23] flex items-center justify-between">
                      <span className="text-[10px] text-[#8A8F98]">Farm Multicontas</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInjectNode(
                          `📱 GeeLark #${phone.nome}`,
                          "canal",
                          "#06B6D4",
                          `Cloud Phone GeeLark ID ${phone.device_id}. Proxy: ${phone.proxy_geo || "Automático"}`,
                          { service: "geelark", device_id: phone.device_id, nome: phone.nome },
                          "Distribuição Multicanal"
                        )}
                        className="h-6 text-[10px] border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 gap-1"
                      >
                        <MapPinPlus className="h-3 w-3" /> Injetar no Mapa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco de Perfis de Redes Sociais */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-pink-400" /> Perfis de Instagram, TikTok & Aquecimento:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingPerfil({ nome: "", tipo: "instagram", warmup_status: "aquecendo" })}
                  className="h-6 text-[10px] border-[#1B1E23] text-zinc-300 hover:text-white gap-1"
                >
                  <Plus className="h-3 w-3" /> Novo Perfil
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredPerfis.map((perfil) => (
                  <div key={perfil.id} className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23] space-y-2 hover:border-[#D6FF4B]/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                          <Instagram className="h-3.5 w-3.5 text-pink-400" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{perfil.nome}</div>
                          <div className="text-[10px] text-[#8A8F98] uppercase font-mono">{perfil.tipo}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[9px] font-mono ${
                        perfil.warmup_status === "pronto" ? "border-emerald-500/30 text-emerald-400" :
                        perfil.warmup_status === "banido" ? "border-red-500/30 text-red-400" :
                        "border-amber-500/30 text-amber-400"
                      }`}>
                        {perfil.warmup_status || "aquecendo"}
                      </Badge>
                    </div>

                    <div className="text-[10px] text-[#8A8F98] flex items-center justify-between font-mono">
                      <span>{perfil.seguidores || 0} seguidores</span>
                      <span>Cloud: {perfil.cloud_phone_provider || "GeeLark"}</span>
                    </div>

                    <div className="pt-2 border-t border-[#1B1E23] flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPerfil(perfil)}
                        className="h-6 text-[10px] text-[#8A8F98] hover:text-white px-1.5"
                      >
                        <Pencil className="h-2.5 w-2.5 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInjectNode(
                          `📸 @${perfil.nome}`,
                          "canal",
                          "#EC4899",
                          `Perfil ${perfil.tipo} - Status: ${perfil.warmup_status || "ativo"}`,
                          { accountId: perfil.id, tipo: perfil.tipo, handle: perfil.nome },
                          "Perfil Orgânico"
                        )}
                        className="h-6 text-[10px] border-pink-500/30 text-pink-300 hover:bg-pink-500/10 gap-1"
                      >
                        <MapPinPlus className="h-3 w-3" /> Injetar no Mapa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ======================================================== */}
          {/* TAB 2: CENTRAL DE ACESSOS & FERRAMENTAS                  */}
          {/* ======================================================== */}
          <TabsContent value="ferramentas" className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-amber-400" /> Acessos & Credenciais da Operação:
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingTool({ name: "", category: "geral" })}
                className="h-6 text-[10px] border-[#1B1E23] text-zinc-300 hover:text-white gap-1"
              >
                <Plus className="h-3 w-3" /> Nova Ferramenta
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredTools.map((tool) => (
                <div key={tool.id} className="p-3 rounded-lg bg-[#0E1013] border border-[#1B1E23] space-y-2.5 hover:border-amber-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                        <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{tool.name}</div>
                        <div className="text-[10px] font-mono text-[#8A8F98]">{tool.category || "geral"}</div>
                      </div>
                    </div>
                    {tool.url && (
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded hover:bg-[#1B1E23] text-[#8A8F98] hover:text-white"
                        title="Abrir URL da ferramenta"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-[#8A8F98] bg-[#0A0B0D] p-2 rounded border border-[#1B1E23] space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Login:</span>
                      <span className="text-zinc-300 truncate max-w-[180px]">{tool.username || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Senha / Token:</span>
                      <span className="text-zinc-400 font-mono">
                        {tool.password_encrypted ? "••••••••••••" : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1B1E23] flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTool(tool)}
                      className="h-6 text-[10px] border-[#1B1E23] text-amber-300 hover:bg-amber-500/10 gap-1"
                    >
                      <Pencil className="h-2.5 w-2.5" /> Ajustar Acesso
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInjectNode(
                        `⚙️ ${tool.name}`,
                        "processo",
                        "#F59E0B",
                        `Acesso & Credencial: ${tool.name}. Login: ${tool.username || "Ver Cofre"}`,
                        { toolId: tool.id, service: tool.name, url: tool.url },
                        "Ferramenta Integrada"
                      )}
                      className="h-6 text-[10px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10 gap-1"
                    >
                      <MapPinPlus className="h-3 w-3" /> Injetar no Mapa
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ======================================================== */}
          {/* TAB 3: PROJETOS & PRODUTOS DEFINIDOS                     */}
          {/* ======================================================== */}
          <TabsContent value="produtos" className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
            <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Package className="h-3.5 w-3.5 text-[#D6FF4B]" /> Ecossistema de Produtos da Empresa:
            </span>

            <div className="space-y-3">
              {projects.map((proj) => {
                const pData = (proj.data || {}) as Record<string, any>;
                const prods = Array.isArray(pData.produtos) ? pData.produtos : [];

                return (
                  <div key={proj.id} className="p-3.5 rounded-lg bg-[#0E1013] border border-[#1B1E23] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          {proj.name}
                          <Badge variant="outline" className="text-[9px] font-mono border-border text-[#8A8F98]">
                            {proj.category || "Geral"}
                          </Badge>
                        </span>
                        <p className="text-[11px] text-[#8A8F98] mt-0.5">
                          {prods.length} produto(s) configurado(s) neste projeto
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInjectNode(
                          `🏢 Hub ${proj.name}`,
                          "canal",
                          "#D6FF4B",
                          `Hub central do projeto ${proj.name} com ${prods.length} produtos.`,
                          { projectId: proj.id },
                          "Hub de Projeto"
                        )}
                        className="h-6 text-[10px] border-[#D6FF4B]/30 text-[#D6FF4B] hover:bg-[#D6FF4B]/10 gap-1"
                      >
                        <MapPinPlus className="h-3 w-3" /> Injetar Projeto no Mapa
                      </Button>
                    </div>

                    {/* Lista de Produtos do Projeto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {prods.map((prod: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded bg-[#0A0B0D] border border-[#1B1E23] flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{prod.nome || "Produto Sem Nome"}</div>
                            <div className="text-[10px] font-mono text-emerald-400">
                              {prod.preco ? `Preço: R$ ${prod.preco}` : prod.ticket ? `Ticket: $ ${prod.ticket}` : "Sem preço definido"}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleInjectNode(
                              `🛒 ${prod.nome}`,
                              "processo",
                              "#10B981",
                              `Produto: ${prod.nome}. Preço: ${prod.preco || prod.ticket || "N/A"}`,
                              { produtoNome: prod.nome, preco: prod.preco, projectId: proj.id },
                              "Oferta / Produto"
                            )}
                            className="h-6 text-[9px] text-[#8A8F98] hover:text-[#D6FF4B] px-1.5"
                            title="Injetar este produto no mapa"
                          >
                            <MapPinPlus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* ======================================================== */}
        {/* MODAL SECUNDÁRIO: AJUSTAR ACESSO / FERRAMENTA           */}
        {/* ======================================================== */}
        <Dialog open={!!editingTool} onOpenChange={(o) => { if (!o) setEditingTool(null); }}>
          <DialogContent className="max-w-md bg-[#0E1013] border-[#1B1E23] text-white">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                {editingTool?.id ? "Ajustar Acesso & Credenciais" : "Cadastrar Nova Ferramenta"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8A8F98]">
                Altere login, senha, token ou chave de API. Salva diretamente no cofre seguro.
              </DialogDescription>
            </DialogHeader>

            {editingTool && (
              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <Label className="text-xs text-[#8A8F98]">Nome da Ferramenta</Label>
                  <Input
                    value={editingTool.name || ""}
                    onChange={(e) => setEditingTool({ ...editingTool, name: e.target.value })}
                    placeholder="Ex: Evolution API, Zernio, GeeLark..."
                    className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[#8A8F98]">URL de Acesso / Endpoint</Label>
                  <Input
                    value={editingTool.url || ""}
                    onChange={(e) => setEditingTool({ ...editingTool, url: e.target.value })}
                    placeholder="https://..."
                    className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-[#8A8F98]">Usuário / Email / Instância</Label>
                    <Input
                      value={editingTool.username || ""}
                      onChange={(e) => setEditingTool({ ...editingTool, username: e.target.value })}
                      placeholder="admin ou jpfreitas"
                      className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#8A8F98]">Categoria</Label>
                    <Input
                      value={editingTool.category || "geral"}
                      onChange={(e) => setEditingTool({ ...editingTool, category: e.target.value })}
                      placeholder="ads, wa, crm, dev..."
                      className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-[#8A8F98]">Senha / Token / API Key</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={editingTool.password_encrypted || ""}
                    onChange={(e) => setEditingTool({ ...editingTool, password_encrypted: e.target.value })}
                    placeholder="Digite a chave ou senha..."
                    className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[#8A8F98]">Notas Técnicas</Label>
                  <Textarea
                    value={editingTool.notes || ""}
                    onChange={(e) => setEditingTool({ ...editingTool, notes: e.target.value })}
                    placeholder="Instruções de acesso, IP liberado, token expira em..."
                    className="bg-[#0A0B0D] border-[#1B1E23] text-white text-xs mt-1"
                    rows={2}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingTool(null)} className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveTool}
                    disabled={savingTool}
                    className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  >
                    {savingTool ? "Salvando..." : "Salvar no Cofre"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ======================================================== */}
        {/* MODAL SECUNDÁRIO: EDITAR PERFIL GEELARK / CONTA         */}
        {/* ======================================================== */}
        <Dialog open={!!editingPerfil} onOpenChange={(o) => { if (!o) setEditingPerfil(null); }}>
          <DialogContent className="max-w-md bg-[#0E1013] border-[#1B1E23] text-white">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-400" />
                {editingPerfil?.id ? "Editar Perfil / Conta" : "Adicionar Novo Perfil"}
              </DialogTitle>
            </DialogHeader>

            {editingPerfil && (
              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <Label className="text-xs text-[#8A8F98]">Nome / Handle (@)</Label>
                  <Input
                    value={editingPerfil.nome || ""}
                    onChange={(e) => setEditingPerfil({ ...editingPerfil, nome: e.target.value })}
                    placeholder="ex: jpfreitas_cortes"
                    className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-[#8A8F98]">Tipo</Label>
                    <Select
                      value={editingPerfil.tipo || "instagram"}
                      onValueChange={(v) => setEditingPerfil({ ...editingPerfil, tipo: v })}
                    >
                      <SelectTrigger className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0E1013] border-[#1B1E23] text-white">
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-[#8A8F98]">Status Aquecimento</Label>
                    <Select
                      value={editingPerfil.warmup_status || "aquecendo"}
                      onValueChange={(v) => setEditingPerfil({ ...editingPerfil, warmup_status: v })}
                    >
                      <SelectTrigger className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0E1013] border-[#1B1E23] text-white">
                        <SelectItem value="aquecendo">Aquecendo</SelectItem>
                        <SelectItem value="pronto">Pronto</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="banido">Banido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-[#8A8F98]">Dispositivo GeeLark Vinculado</Label>
                  <Select
                    value={editingPerfil.cloud_phone_provider || "geelark_04"}
                    onValueChange={(v) => setEditingPerfil({ ...editingPerfil, cloud_phone_provider: v })}
                  >
                    <SelectTrigger className="h-8 bg-[#0A0B0D] border-[#1B1E23] text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0E1013] border-[#1B1E23] text-white">
                      <SelectItem value="geelark_04">GeeLark Aparelho 04</SelectItem>
                      <SelectItem value="geelark_05">GeeLark Aparelho 05</SelectItem>
                      <SelectItem value="outro">Outro / Físico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingPerfil(null)} className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePerfil}
                    disabled={savingPerfil}
                    className="h-8 text-xs bg-[#D6FF4B] hover:bg-[#D6FF4B]/90 text-black font-semibold"
                  >
                    {savingPerfil ? "Salvando..." : "Salvar Perfil"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
