import React, { useState, useEffect, useMemo } from "react";
import type { Tables, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Layers,
  ArrowRight,
  TrendingUp,
  Workflow,
  Sparkles,
  Link2,
  Edit2,
  Search,
  ShoppingCart,
  Crown,
  Zap,
  Tag,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { normalizeProductLinks, ProductLink } from "@/lib/produto-links";

interface Props {
  projectId: string;
  project: Tables<"imphq_projects">;
  onUpdateData: (newData: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export type ValueTier = "aquisicao" | "core" | "ascensao" | "premium";

const VALUE_TIERS: {
  key: ValueTier;
  label: string;
  badge: string;
  color: string;
  borderColor: string;
  bg: string;
  desc: string;
  priceRange: string;
}[] = [
  {
    key: "aquisicao",
    label: "Aquisição / Front-End",
    badge: "Front-End",
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
    bg: "bg-blue-500/5",
    desc: "Produtos de entrada (R$7 a R$97) ou iscas com baixo atrito para transformar desconhecidos em clientes pagantes.",
    priceRange: "R$ 7 – R$ 97",
  },
  {
    key: "core",
    label: "Core Offer (Principal)",
    badge: "Carro-Chefe",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    desc: "A oferta principal com a maior taxa de conversão e promessa central da marca.",
    priceRange: "R$ 97 – R$ 497",
  },
  {
    key: "ascensao",
    label: "Ascensão / Upsell",
    badge: "Alavanca de AOV",
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
    bg: "bg-amber-500/5",
    desc: "Order bumps e 1-click upsells que multiplicam o ticket médio imediato sem custo extra de tráfego.",
    priceRange: "R$ 27 – R$ 297",
  },
  {
    key: "premium",
    label: "Premium / High Ticket",
    badge: "Maximizador de LTV",
    color: "text-rose-400",
    borderColor: "border-rose-500/30",
    bg: "bg-rose-500/5",
    desc: "Mentorias, assinaturas recorrentes, consultorias e produtos VIP para os 10-20% melhores compradores.",
    priceRange: "R$ 997+",
  },
];

const PLATFORM_BADGES: Record<string, { label: string; color: string }> = {
  hotmart: { label: "Hotmart", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  kiwify: { label: "Kiwify", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  ticto: { label: "Ticto", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  hubla: { label: "Hubla", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  eduzz: { label: "Eduzz", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  braip: { label: "Braip", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  whop: { label: "Whop", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  monetizze: { label: "Monetizze", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
};

function inferCluster(p: any): ValueTier {
  const tipo = (p.tipo_oferta || p.tipo || "").toLowerCase();
  const nome = (p.nome || p.name || "").toLowerCase();
  const preco = parseFloat(String(p.preco || p.preco_por || "0").replace(/[^0-9.]/g, ""));

  if (tipo.includes("tripwire") || tipo.includes("isca") || tipo.includes("aquisicao") || nome.includes("grátis") || (preco > 0 && preco <= 97 && (tipo.includes("ebook") || nome.includes("starter")))) {
    return "aquisicao";
  }
  if (tipo.includes("upsell") || tipo.includes("bump") || tipo.includes("ascensao") || tipo.includes("orderbump")) {
    return "ascensao";
  }
  if (tipo.includes("premium") || tipo.includes("mentoria") || tipo.includes("high ticket") || tipo.includes("assinatura") || preco >= 997) {
    return "premium";
  }
  return "core";
}

export function ProjetoEcossistema({ projectId, project, onUpdateData, onNavigateTab }: Props) {
  // Extract project products from data
  const projectData = useMemo(() => jsonFields(project.data), [project.data]);
  const rawProducts = useMemo(() => {
    const list = projectData.produtos;
    return Array.isArray(list) ? list : [];
  }, [projectData]);

  // OpenFlow automations for this project
  const [automacoes, setAutomacoes] = useState<Tables<"imphq_automacoes">[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);

  // Filter state
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");

  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<{
    nome: string;
    preco: string;
    tipo_oferta: ValueTier;
    tipo: string;
    plataforma: string;
    descricao: string;
    checkout_url: string;
  }>({
    nome: "",
    preco: "",
    tipo_oferta: "core",
    tipo: "Infoproduto",
    plataforma: "kiwify",
    descricao: "",
    checkout_url: "",
  });

  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Fetch automations to show linked flows per product
  useEffect(() => {
    let isMounted = true;
    async function loadFlows() {
      setLoadingFlows(true);
      const { data } = await supabase
        .from("imphq_automacoes")
        .select("*")
        .eq("project_id", projectId);
      if (isMounted) {
        setAutomacoes(data || []);
        setLoadingFlows(false);
      }
    }
    loadFlows();
    return () => { isMounted = false; };
  }, [projectId]);

  // Normalize products with explicit tier
  const products = useMemo(() => {
    return rawProducts.map((p: any, idx: number) => {
      const nome = typeof p === "string" ? p : p.nome || p.name || `Produto ${idx + 1}`;
      const preco = typeof p === "object" ? String(p.preco || p.preco_por || p.price || "") : "";
      const tipo = typeof p === "object" ? String(p.tipo || "Infoproduto") : "Infoproduto";
      const tipo_oferta: ValueTier = (typeof p === "object" && p.tipo_oferta) ? p.tipo_oferta : inferCluster(p);
      const plataforma = typeof p === "object" ? String(p.plataforma || "").toLowerCase() : "";
      const descricao = typeof p === "object" ? String(p.descricao || "") : "";
      const links = normalizeProductLinks(p);
      const ofertas = typeof p === "object" && Array.isArray(p.ofertas) ? p.ofertas : [];

      return {
        originalIndex: idx,
        nome,
        preco,
        tipo,
        tipo_oferta,
        plataforma,
        descricao,
        links,
        ofertas,
        raw: p,
      };
    });
  }, [rawProducts]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedProductFilter !== "__all__" && p.nome !== selectedProductFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.nome.toLowerCase().includes(q);
        const matchDesc = p.descricao.toLowerCase().includes(q);
        const matchType = p.tipo.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchType) return false;
      }
      return true;
    });
  }, [products, selectedProductFilter, searchQuery]);

  // KPIs
  const kpis = useMemo(() => {
    const total = products.length;
    const aquisicao = products.filter(p => p.tipo_oferta === "aquisicao").length;
    const core = products.filter(p => p.tipo_oferta === "core").length;
    const ascensao = products.filter(p => p.tipo_oferta === "ascensao").length;
    const premium = products.filter(p => p.tipo_oferta === "premium").length;
    return { total, aquisicao, core, ascensao, premium };
  }, [products]);

  // Save product changes back to project data
  const handleUpdateProductTier = (index: number, newTier: ValueTier) => {
    const nextList = [...rawProducts];
    const current = nextList[index];
    if (typeof current === "object" && current !== null) {
      nextList[index] = { ...current, tipo_oferta: newTier };
    } else {
      nextList[index] = { nome: current, tipo_oferta: newTier };
    }
    onUpdateData({ ...projectData, produtos: nextList });
    toast.success("Nível da escada de valor atualizado!");
  };

  // Open modal to add product
  const handleOpenAdd = () => {
    setEditingIndex(null);
    setProductForm({
      nome: "",
      preco: "",
      tipo_oferta: "core",
      tipo: "Infoproduto",
      plataforma: "kiwify",
      descricao: "",
      checkout_url: "",
    });
    setProductModalOpen(true);
  };

  // Open modal to edit product
  const handleOpenEdit = (index: number) => {
    const target = products.find(p => p.originalIndex === index);
    if (!target) return;
    setEditingIndex(index);
    const checkoutLink = target.links.find(l => l.tipo === "checkout")?.url || "";
    setProductForm({
      nome: target.nome,
      preco: target.preco,
      tipo_oferta: target.tipo_oferta,
      tipo: target.tipo,
      plataforma: target.plataforma || "kiwify",
      descricao: target.descricao,
      checkout_url: checkoutLink,
    });
    setProductModalOpen(true);
  };

  // Save modal form
  const handleSaveProduct = () => {
    if (!productForm.nome.trim()) {
      toast.error("O nome do produto é obrigatório.");
      return;
    }

    const nextList = [...rawProducts];
    const existing = editingIndex !== null ? nextList[editingIndex] : {};
    const baseObject = typeof existing === "object" && existing !== null ? existing : {};

    // Prepare links
    let links = Array.isArray(baseObject.links) ? [...baseObject.links] : [];
    if (productForm.checkout_url.trim()) {
      const cleanUrl = productForm.checkout_url.trim();
      const existingCheckoutIdx = links.findIndex((l: any) => l.tipo === "checkout");
      if (existingCheckoutIdx >= 0) {
        links[existingCheckoutIdx] = { ...links[existingCheckoutIdx], url: cleanUrl, ativo: true };
      } else {
        links.unshift({ url: cleanUrl, label: "Checkout", tipo: "checkout", prioridade_ia: "preferido", ativo: true });
      }
    }

    const updatedProduct = {
      ...baseObject,
      nome: productForm.nome.trim(),
      preco: productForm.preco.trim(),
      preco_por: productForm.preco.trim(),
      tipo_oferta: productForm.tipo_oferta,
      tipo: productForm.tipo,
      plataforma: productForm.plataforma,
      descricao: productForm.descricao.trim(),
      links,
    };

    if (editingIndex !== null) {
      nextList[editingIndex] = updatedProduct;
      toast.success(`Produto "${productForm.nome}" atualizado!`);
    } else {
      nextList.push(updatedProduct);
      toast.success(`Novo produto "${productForm.nome}" adicionado ao projeto!`);
    }

    onUpdateData({ ...projectData, produtos: nextList });
    setProductModalOpen(false);
  };

  // Confirm delete
  const handleDeleteProduct = () => {
    if (deleteIndex === null) return;
    const nextList = rawProducts.filter((_: any, i: number) => i !== deleteIndex);
    onUpdateData({ ...projectData, produtos: nextList });
    toast.success("Produto removido do projeto.");
    setDeleteIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & TOP ACTIONS ── */}
      <div className="bg-[#0E1013] border border-[#1B1E23] rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#D6FF4B]/10 border border-[#D6FF4B]/20 flex items-center justify-center">
                <Package className="h-4 w-4 text-[#D6FF4B]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  Ecossistema & Escada de Valor
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    {project.name}
                  </Badge>
                </h2>
                <p className="text-xs text-[#8A8F98]">
                  Arquitetura de monetização deste projeto: produtos, ofertas, checkouts e esteira de valor da aquisição ao LTV.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="h-8 text-xs bg-[#D6FF4B] text-black font-semibold hover:bg-[#c2eb3d] shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              + Novo Produto
            </Button>
          </div>
        </div>

        {/* 4 KPIs by Level */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {VALUE_TIERS.map((tier) => {
            const count = kpis[tier.key];
            return (
              <div
                key={tier.key}
                className={`bg-[#0A0B0D] border ${tier.borderColor} rounded-lg p-3 flex items-center justify-between transition-all`}
              >
                <div>
                  <p className="text-[10px] font-mono uppercase text-[#8A8F98] tracking-wider">{tier.badge}</p>
                  <p className={`text-lg font-bold font-mono mt-0.5 ${tier.color}`}>{count}</p>
                  <p className="text-[9px] text-muted-foreground">{tier.priceRange}</p>
                </div>
                <div className={`w-8 h-8 rounded-full ${tier.bg} border ${tier.borderColor} flex items-center justify-center`}>
                  <Package className={`h-4 w-4 ${tier.color}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-[#1B1E23]/60">
          <div className="relative flex-1 w-full">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, tipo ou descrição do produto..."
              className="h-8 pl-8 text-xs bg-[#0A0B0D] border-[#1B1E23]"
            />
          </div>

          <Select value={selectedProductFilter} onValueChange={setSelectedProductFilter}>
            <SelectTrigger className="w-full sm:w-[260px] h-8 text-xs bg-[#0A0B0D] border-[#1B1E23]">
              <div className="flex items-center gap-1.5 truncate">
                <Tag className="h-3.5 w-3.5 text-[#D6FF4B] shrink-0" />
                <SelectValue placeholder="Filtrar por produto" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os Produtos ({products.length})</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.nome} value={p.nome} className="text-xs">
                  📦 {p.nome} {p.preco ? `(R$ ${p.preco})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedProductFilter !== "__all__" || searchQuery) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedProductFilter("__all__");
                setSearchQuery("");
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕ Limpar Filtro
            </Button>
          )}
        </div>
      </div>

      {/* ── THE VALUE LADDER (4 TIERS) ── */}
      <div className="space-y-6">
        {VALUE_TIERS.map((tier) => {
          const tierProducts = filteredProducts.filter((p) => p.tipo_oferta === tier.key);
          if (selectedProductFilter !== "__all__" && tierProducts.length === 0) return null;

          return (
            <div
              key={tier.key}
              className={`rounded-xl border ${tier.borderColor} ${tier.bg} p-4 space-y-3 transition-all`}
            >
              {/* Tier Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#1B1E23]/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${tier.color}`}>
                    {tier.label}
                  </h3>
                  <Badge variant="outline" className={`text-[10px] font-mono border-[#1B1E23] ${tier.color}`}>
                    {tierProducts.length} produto(s)
                  </Badge>
                </div>
                <span className="text-[11px] text-[#8A8F98]">{tier.desc}</span>
              </div>

              {/* Products in this tier */}
              {tierProducts.length === 0 ? (
                <div className="py-6 text-center rounded-lg border border-dashed border-[#1B1E23] bg-[#0A0B0D]/30 space-y-1">
                  <p className="text-xs text-muted-foreground italic">Nenhum produto cadastrado neste nível de escada.</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingIndex(null);
                      setProductForm({
                        nome: "",
                        preco: "",
                        tipo_oferta: tier.key,
                        tipo: "Infoproduto",
                        plataforma: "kiwify",
                        descricao: "",
                        checkout_url: "",
                      });
                      setProductModalOpen(true);
                    }}
                    className="h-7 text-xs text-[#D6FF4B] hover:bg-[#D6FF4B]/10"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar em {tier.badge}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tierProducts.map((prod) => {
                    const plat = PLATFORM_BADGES[prod.plataforma] || {
                      label: prod.plataforma || "Checkout Próprio",
                      color: "bg-muted text-muted-foreground border-border",
                    };

                    // Checkouts
                    const checkoutLink = prod.links.find((l) => l.tipo === "checkout")?.url;

                    // Linked OpenFlow automations
                    const prodAutomacoes = automacoes.filter(
                      (a) => a.produto?.toLowerCase() === prod.nome.toLowerCase()
                    );

                    return (
                      <Card
                        key={prod.originalIndex}
                        className="bg-[#0A0B0D] border-[#1B1E23] hover:border-primary/30 transition-all flex flex-col justify-between"
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Title & Price */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-white truncate" title={prod.nome}>
                                {prod.nome}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {prod.plataforma && (
                                  <Badge variant="outline" className={`text-[9px] font-mono ${plat.color}`}>
                                    {plat.label}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[9px]">
                                  {prod.tipo}
                                </Badge>
                              </div>
                            </div>

                            {prod.preco && (
                              <span className="text-sm font-mono font-bold text-[#D6FF4B] shrink-0">
                                R$ {prod.preco}
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          {prod.descricao && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 bg-[#0E1013] p-2 rounded border border-[#1B1E23]/60">
                              {prod.descricao}
                            </p>
                          )}

                          {/* Checkout Link */}
                          {checkoutLink ? (
                            <div className="flex items-center justify-between bg-[#0E1013] border border-[#1B1E23] rounded p-2 text-xs">
                              <div className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                                <ShoppingCart className="h-3 w-3 text-emerald-400 shrink-0" />
                                <span className="truncate">{checkoutLink}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-white"
                                  onClick={() => {
                                    navigator.clipboard.writeText(checkoutLink);
                                    toast.success("Link copiado!");
                                  }}
                                  title="Copiar Link"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-emerald-400"
                                  onClick={() => window.open(checkoutLink, "_blank")}
                                  title="Abrir Checkout"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded p-2 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Sem link de checkout
                              </span>
                              <button
                                onClick={() => handleOpenEdit(prod.originalIndex)}
                                className="underline hover:text-amber-300"
                              >
                                Configurar
                              </button>
                            </div>
                          )}

                          {/* Offers / Bumps */}
                          {prod.ofertas.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-[#1B1E23]/60">
                              <p className="text-[9px] font-mono uppercase text-muted-foreground">
                                Ofertas Vinculadas ({prod.ofertas.length}):
                              </p>
                              <div className="space-y-1">
                                {prod.ofertas.map((of: any, oi: number) => (
                                  <div
                                    key={oi}
                                    className="flex items-center justify-between text-[10px] bg-[#0E1013] px-2 py-1 rounded border border-[#1B1E23]/40"
                                  >
                                    <span className="truncate flex-1 text-muted-foreground">
                                      {of.nome || `Oferta ${oi + 1}`}
                                    </span>
                                    {of.preco_por && (
                                      <span className="font-mono text-[#D6FF4B] ml-2">R$ {of.preco_por}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* OpenFlow automations */}
                          <div className="space-y-1 pt-1 border-t border-[#1B1E23]/60">
                            <div className="flex items-center justify-between text-[9px] font-mono uppercase text-muted-foreground">
                              <span>Fluxos OpenFlow:</span>
                              {onNavigateTab && (
                                <button
                                  onClick={() => onNavigateTab("raiox")}
                                  className="text-[9px] text-[#D6FF4B] hover:underline flex items-center gap-0.5"
                                >
                                  Ver no Raio-X <ArrowRight className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>

                            {prodAutomacoes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {prodAutomacoes.map((a) => (
                                  <Badge
                                    key={a.id}
                                    variant="outline"
                                    className={`text-[9px] font-mono ${
                                      a.ativo
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "bg-muted text-muted-foreground border-border"
                                    }`}
                                  >
                                    ⚡ {a.nome}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/60 italic">
                                Nenhum fluxo específico configurado para este produto.
                              </p>
                            )}
                          </div>

                          {/* Tier Switcher Dropdown */}
                          <div className="pt-2 border-t border-[#1B1E23] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="text-[10px] text-muted-foreground">Nível:</span>
                              <Select
                                value={prod.tipo_oferta}
                                onValueChange={(val: ValueTier) => handleUpdateProductTier(prod.originalIndex, val)}
                              >
                                <SelectTrigger className="h-6 text-[10px] font-mono bg-[#0E1013] border-[#1B1E23] flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VALUE_TIERS.map((t) => (
                                    <SelectItem key={t.key} value={t.key} className="text-xs">
                                      {t.badge} ({t.label})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-white"
                                onClick={() => handleOpenEdit(prod.originalIndex)}
                                title="Editar Produto"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteIndex(prod.originalIndex)}
                                title="Remover Produto"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── MODAL: ADICIONAR / EDITAR PRODUTO ── */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="bg-[#0E1013] border-[#1B1E23] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Package className="h-4 w-4 text-[#D6FF4B]" />
              {editingIndex !== null ? "Editar Produto do Ecossistema" : "Novo Produto para o Projeto"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8A8F98]">
              Cadastre o produto na escada de valor deste projeto com preços, plataforma e links de checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do Produto *</Label>
              <Input
                value={productForm.nome}
                onChange={(e) => setProductForm({ ...productForm, nome: e.target.value })}
                placeholder="Ex: O Código dos Cortes Perfeitos"
                className="h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
                <Input
                  value={productForm.preco}
                  onChange={(e) => setProductForm({ ...productForm, preco: e.target.value })}
                  placeholder="Ex: 47,00"
                  className="h-8 text-xs font-mono bg-[#0A0B0D] border-[#1B1E23] mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nível na Escada de Valor</Label>
                <Select
                  value={productForm.tipo_oferta}
                  onValueChange={(val: ValueTier) => setProductForm({ ...productForm, tipo_oferta: val })}
                >
                  <SelectTrigger className="h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALUE_TIERS.map((t) => (
                      <SelectItem key={t.key} value={t.key} className="text-xs">
                        {t.badge} ({t.label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Plataforma de Checkout</Label>
                <Select
                  value={productForm.plataforma}
                  onValueChange={(val) => setProductForm({ ...productForm, plataforma: val })}
                >
                  <SelectTrigger className="h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kiwify">Kiwify</SelectItem>
                    <SelectItem value="hotmart">Hotmart</SelectItem>
                    <SelectItem value="ticto">Ticto</SelectItem>
                    <SelectItem value="hubla">Hubla</SelectItem>
                    <SelectItem value="eduzz">Eduzz</SelectItem>
                    <SelectItem value="braip">Braip</SelectItem>
                    <SelectItem value="whop">Whop</SelectItem>
                    <SelectItem value="monetizze">Monetizze</SelectItem>
                    <SelectItem value="outro">Outro / Checkout Próprio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Produto</Label>
                <Select
                  value={productForm.tipo}
                  onValueChange={(val) => setProductForm({ ...productForm, tipo: val })}
                >
                  <SelectTrigger className="h-8 text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Infoproduto">Infoproduto / Curso</SelectItem>
                    <SelectItem value="Físico">Produto Físico / Encapsulado</SelectItem>
                    <SelectItem value="Assinatura">Assinatura / Comunidade</SelectItem>
                    <SelectItem value="Mentoria">Mentoria / High Ticket</SelectItem>
                    <SelectItem value="Evento">Evento / Workshop</SelectItem>
                    <SelectItem value="Serviço">Serviço / Consultoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">URL de Checkout Principal</Label>
              <Input
                value={productForm.checkout_url}
                onChange={(e) => setProductForm({ ...productForm, checkout_url: e.target.value })}
                placeholder="https://pay.kiwify.com.br/..."
                className="h-8 text-xs font-mono bg-[#0A0B0D] border-[#1B1E23] mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Descrição / Promessa do Produto</Label>
              <Textarea
                value={productForm.descricao}
                onChange={(e) => setProductForm({ ...productForm, descricao: e.target.value })}
                placeholder="Breve resumo da transformação, entregáveis ou mecanismo..."
                className="text-xs bg-[#0A0B0D] border-[#1B1E23] mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProductModalOpen(false)} className="text-xs border-[#1B1E23]">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveProduct}
              className="text-xs bg-[#D6FF4B] text-black font-semibold hover:bg-[#c2eb3d]"
            >
              Salvar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: CONFIRMAR EXCLUSÃO DE PRODUTO ── */}
      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent className="bg-[#0E1013] border-[#1B1E23]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-white">
              Remover este produto do projeto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              O produto será retirado da esteira de valor deste projeto. Links e configurações associadas no briefing serão atualizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs border-[#1B1E23]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
