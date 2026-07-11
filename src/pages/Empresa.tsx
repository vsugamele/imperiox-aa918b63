import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Mail, Instagram, Music2, Building2, Eye, EyeOff, Pencil, CreditCard, Youtube, KeyRound, List, LayoutGrid, Upload, X, Map as MapIcon } from "lucide-react";
import { AdAccountsTab } from "@/components/empresa/AdAccountsTab";
import { ZernioTab } from "@/components/empresa/ZernioTab";
import { toast } from "sonner";


interface ContaEmpresa {
  id: string;
  nome: string;
  tipo: string;
  valor?: string;
  foto_url?: string | null;
  mapa_node_id?: string | null;
  extra?: {
    senha?: string;
    telefone?: string;
    status_aquecimento?: string;
    data_compra?: string;
    perfil_instagram?: string;
    seguidores?: string;
    bio?: string;
    channel_url?: string;
    ativo?: string;
  };
}

interface MapNode { id: string; label: string; }


const AQUECIMENTO_STATUS = ["Inativo", "Aquecendo", "Pronto", "Banido"];
const YOUTUBE_STATUS = ["Ativo", "Inativo", "Em Análise", "Monetizado"];

export default function Empresa() {
  const [contas, setContas] = useState<ContaEmpresa[]>([]);
  const [mapNodes, setMapNodes] = useState<MapNode[]>([]);
  const [activeTab, setActiveTab] = useState("email");

  const load = async () => {
    const { data } = await supabase.from("imphq_empresa").select("*").order("created_at", { ascending: false });
    setContas((data || []) as ContaEmpresa[]);
  };

  const loadNodes = async () => {
    const { data } = await supabase.from("imphq_company_map_nodes").select("id, label").order("label");
    setMapNodes((data || []) as MapNode[]);
  };

  useEffect(() => { load(); loadNodes(); }, []);

  const filterByType = (tipo: string) => contas.filter(c => c.tipo === tipo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold">Controle da Empresa</h1>
            <p className="text-xs text-muted-foreground">Gerencie emails, contas de redes sociais e ativos digitais da operação</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 mr-1" /> Emails</TabsTrigger>
          <TabsTrigger value="instagram"><Instagram className="h-3.5 w-3.5 mr-1" /> Instagram</TabsTrigger>
          <TabsTrigger value="tiktok"><Music2 className="h-3.5 w-3.5 mr-1" /> TikTok</TabsTrigger>
          <TabsTrigger value="youtube"><Youtube className="h-3.5 w-3.5 mr-1" /> YouTube</TabsTrigger>
          <TabsTrigger value="ad_accounts"><CreditCard className="h-3.5 w-3.5 mr-1" /> Ad Accounts</TabsTrigger>
          <TabsTrigger value="zernio"><KeyRound className="h-3.5 w-3.5 mr-1" /> Zernio</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <AccountTable contas={filterByType("email")} tipo="email" mapNodes={mapNodes}
            columns={["Gmail", "Senha", "Em Uso", "Telefone", "Aquecido", "Data Compra", "Perfil Instagram"]}
            onRefresh={load} />
        </TabsContent>
        <TabsContent value="instagram">
          <AccountTable contas={filterByType("instagram")} tipo="instagram" mapNodes={mapNodes}
            columns={["Perfil", "Usuário", "Senha", "Seguidores", "Bio", "Status"]}
            onRefresh={load} />
        </TabsContent>
        <TabsContent value="tiktok">
          <AccountTable contas={filterByType("tiktok")} tipo="tiktok" mapNodes={mapNodes}
            columns={["Perfil", "Usuário", "Senha", "Seguidores", "Bio", "Status"]}
            onRefresh={load} />
        </TabsContent>
        <TabsContent value="youtube">
          <AccountTable contas={filterByType("youtube")} tipo="youtube" mapNodes={mapNodes}
            columns={["Canal", "URL do Canal", "Inscritos", "Bio", "Status"]}
            onRefresh={load} />
        </TabsContent>
        <TabsContent value="ad_accounts">
          <AdAccountsTab />
        </TabsContent>
        <TabsContent value="zernio">
          <ZernioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountTable({ contas, tipo, columns, onRefresh, mapNodes }: {
  contas: ContaEmpresa[];
  tipo: string;
  columns: string[];
  onRefresh: () => void;
  mapNodes: MapNode[];
}) {

  const [showDialog, setShowDialog] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaEmpresa | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const viewKey = `empresa-view-${tipo}`;
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(viewKey) as "list" | "grid") || "list";
  });
  useEffect(() => { try { localStorage.setItem(viewKey, view); } catch {} }, [view, viewKey]);

  const emptyForm = {
    nome: "", valor: "", senha: "", telefone: "",
    status_aquecimento: "Inativo", data_compra: "", perfil_instagram: "",
    seguidores: "", bio: "", channel_url: "", ativo: "Ativo",
    foto_url: "" as string, mapa_node_id: "" as string,
  };
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const openAdd = () => {
    setEditingConta(null);
    setForm(emptyForm);
    setShowFormPassword(false);
    setShowDialog(true);
  };

  const openEdit = (conta: ContaEmpresa) => {
    setEditingConta(conta);
    setForm({
      nome: conta.nome || "",
      valor: conta.valor || "",
      senha: conta.extra?.senha || "",
      telefone: conta.extra?.telefone || "",
      status_aquecimento: conta.extra?.status_aquecimento || "Inativo",
      data_compra: conta.extra?.data_compra || "",
      perfil_instagram: conta.extra?.perfil_instagram || "",
      seguidores: conta.extra?.seguidores || "",
      bio: conta.extra?.bio || "",
      channel_url: conta.extra?.channel_url || "",
      ativo: conta.extra?.ativo || "Ativo",
      foto_url: conta.foto_url || "",
      mapa_node_id: conta.mapa_node_id || "",
    });
    setShowFormPassword(false);
    setShowDialog(true);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `empresa/${tipo}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("company-map-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("company-map-images").getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
      toast.success("Foto carregada");
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: form.nome,
      tipo,
      valor: form.valor || null,
      foto_url: form.foto_url || null,
      mapa_node_id: form.mapa_node_id || null,
      extra: {
        senha: form.senha || null,
        telefone: form.telefone || null,
        status_aquecimento: form.status_aquecimento,
        data_compra: form.data_compra || null,
        perfil_instagram: form.perfil_instagram || null,
        seguidores: form.seguidores || null,
        bio: form.bio || null,
        channel_url: form.channel_url || null,
        ativo: form.ativo || null,
      },
    } as any;

    if (editingConta) {
      const { error } = await supabase.from("imphq_empresa").update(payload).eq("id", editingConta.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Conta atualizada!");
    } else {
      const { error } = await supabase.from("imphq_empresa").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Conta adicionada!");
    }
    setShowDialog(false);
    setForm(emptyForm);
    setEditingConta(null);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_empresa").delete().eq("id", id);
    toast.success("Conta removida");
    onRefresh();
  };

  const nodeLabel = (id?: string | null) => mapNodes.find(n => n.id === id)?.label;


  const labelByTipo = tipo === "email" ? "Email" : tipo === "instagram" ? "Instagram" : tipo === "tiktok" ? "TikTok" : "YouTube";
  const iconByTipo = tipo === "email" ? "📧" : tipo === "instagram" ? "📸" : tipo === "tiktok" ? "🎵" : "📺";

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <Button
            size="icon"
            variant={view === "list" ? "secondary" : "ghost"}
            className="h-7 w-7"
            title="Lista"
            onClick={() => setView("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={view === "grid" ? "secondary" : "ghost"}
            className="h-7 w-7"
            title="Cards"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar {labelByTipo}
        </Button>
      </div>

      {contas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-3xl mb-2">{iconByTipo}</p>
          <p className="text-sm">Nenhum {labelByTipo.toLowerCase()} cadastrado ainda</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {contas.map((c) => {
            const statusText = tipo === "youtube" ? (c.extra?.ativo || "Inativo") : (c.extra?.status_aquecimento || "Inativo");
            const statusClass = tipo === "youtube"
              ? (c.extra?.ativo === "Ativo" || c.extra?.ativo === "Monetizado" ? "border-emerald-500/30 text-emerald-400" : c.extra?.ativo === "Inativo" ? "border-red-500/30 text-red-400" : "")
              : (statusText === "Pronto" ? "border-emerald-500/30 text-emerald-400" : statusText === "Aquecendo" ? "border-amber-500/30 text-amber-400" : statusText === "Banido" ? "border-red-500/30 text-red-400" : "");
            const title = tipo === "email" || tipo === "youtube" ? c.nome : `@${c.nome}`;
            return (
              <div key={c.id} className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition group flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.foto_url ? (
                      <img src={c.foto_url} alt={title} className="h-10 w-10 rounded-md object-cover shrink-0 border border-border" />
                    ) : (
                      <span className="text-base shrink-0">{iconByTipo}</span>
                    )}
                    <span className="text-sm font-medium truncate" title={title}>{title}</span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${statusClass}`}>{statusText}</Badge>
                </div>
                {c.mapa_node_id && nodeLabel(c.mapa_node_id) && (
                  <Link to={`/funis?view=mapa&node=${c.mapa_node_id}`} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline w-fit">
                    <MapIcon className="h-3 w-3" /> {nodeLabel(c.mapa_node_id)}
                  </Link>
                )}


                <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                  {tipo === "email" && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="opacity-70">Senha</span>
                        <span className="flex items-center gap-1 text-foreground/80 font-mono">
                          {visiblePasswords[c.id] ? (c.extra?.senha || "—") : "••••••••"}
                          {c.extra?.senha && (
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => togglePasswordVisibility(c.id)}>
                              {visiblePasswords[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Em uso</span><span className="text-foreground/80 truncate">{c.valor || "—"}</span></div>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Telefone</span><span className="text-foreground/80">{c.extra?.telefone || "—"}</span></div>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Data compra</span><span className="text-foreground/80">{c.extra?.data_compra || "—"}</span></div>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Perfil IG</span><span className="text-foreground/80 truncate">{c.extra?.perfil_instagram || "—"}</span></div>
                    </>
                  )}

                  {tipo === "youtube" && (
                    <>
                      <div className="flex justify-between gap-2">
                        <span className="opacity-70">Canal</span>
                        {c.extra?.channel_url ? (
                          <a href={c.extra.channel_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[60%]">{c.extra.channel_url}</a>
                        ) : <span className="text-foreground/80">—</span>}
                      </div>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Inscritos</span><span className="text-foreground/80">{c.extra?.seguidores || "—"}</span></div>
                      {c.extra?.bio && <p className="text-foreground/70 line-clamp-2 pt-1">{c.extra.bio}</p>}
                    </>
                  )}

                  {(tipo === "instagram" || tipo === "tiktok") && (
                    <>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Usuário</span><span className="text-foreground/80 truncate">{c.valor || "—"}</span></div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="opacity-70">Senha</span>
                        <span className="flex items-center gap-1 text-foreground/80 font-mono">
                          {visiblePasswords[c.id] ? (c.extra?.senha || "—") : "••••••••"}
                          {c.extra?.senha && (
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => togglePasswordVisibility(c.id)}>
                              {visiblePasswords[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2"><span className="opacity-70">Seguidores</span><span className="text-foreground/80">{c.extra?.seguidores || "—"}</span></div>
                      {c.extra?.bio && <p className="text-foreground/70 line-clamp-2 pt-1">{c.extra.bio}</p>}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 border-t border-border/50 pt-2 mt-auto">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(c => <TableHead key={c} className="text-[10px] uppercase">{c}</TableHead>)}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((c) => (
                <TableRow key={c.id}>
                  {tipo === "email" ? (
                    <>
                      <TableCell className="font-medium text-sm"><NameCell conta={c} title={c.nome} nodeLabel={nodeLabel(c.mapa_node_id)} /></TableCell>

                      <TableCell className="text-xs text-muted-foreground flex items-center justify-between min-w-[120px]">
                        {visiblePasswords[c.id] ? (c.extra?.senha || "—") : "••••••••"}
                        {c.extra?.senha && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 hover:bg-secondary/50" onClick={() => togglePasswordVisibility(c.id)}>
                            {visiblePasswords[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.valor || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.extra?.telefone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px]">{c.extra?.status_aquecimento || "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.extra?.data_compra || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.extra?.perfil_instagram || "—"}</TableCell>
                    </>
                  ) : tipo === "youtube" ? (
                    <>
                      <TableCell className="font-medium text-sm">{c.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.extra?.channel_url ? (
                          <a href={c.extra.channel_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px] block">
                            {c.extra.channel_url}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{c.extra?.seguidores || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.extra?.bio || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${c.extra?.ativo === "Ativo" || c.extra?.ativo === "Monetizado" ? "border-emerald-500/30 text-emerald-400" : c.extra?.ativo === "Inativo" ? "border-red-500/30 text-red-400" : ""}`}>
                          {c.extra?.ativo || "Inativo"}
                        </Badge>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium text-sm">@{c.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.valor || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-center justify-between min-w-[120px]">
                        {visiblePasswords[c.id] ? (c.extra?.senha || "—") : "••••••••"}
                        {c.extra?.senha && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 hover:bg-secondary/50" onClick={() => togglePasswordVisibility(c.id)}>
                            {visiblePasswords[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.extra?.seguidores || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.extra?.bio || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px]">{c.extra?.status_aquecimento || "Inativo"}</Badge>
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar" : "Adicionar"} {iconByTipo} {labelByTipo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {tipo === "email" ? (
              <>
                <div><Label>Gmail *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="nome@gmail.com" /></div>
                <div>
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input type={showFormPassword ? "text" : "password"} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="Senha da conta" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground" onClick={() => setShowFormPassword(!showFormPassword)}>
                      {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="+55 11 9xxxx-xxxx" /></div>
                <div>
                  <Label>Status de Aquecimento</Label>
                  <Select value={form.status_aquecimento} onValueChange={v => setForm({ ...form, status_aquecimento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AQUECIMENTO_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data de Compra</Label><Input type="date" value={form.data_compra} onChange={e => setForm({ ...form, data_compra: e.target.value })} /></div>
                <div><Label>Perfil Instagram Vinculado</Label><Input value={form.perfil_instagram} onChange={e => setForm({ ...form, perfil_instagram: e.target.value })} placeholder="@nomedoperfil" /></div>
              </>
            ) : tipo === "youtube" ? (
              <>
                <div><Label>Nome do Canal *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Meu Canal" /></div>
                <div><Label>URL do Canal</Label><Input value={form.channel_url} onChange={e => setForm({ ...form, channel_url: e.target.value })} placeholder="https://youtube.com/@seucanal" /></div>
                <div><Label>Inscritos</Label><Input value={form.seguidores} onChange={e => setForm({ ...form, seguidores: e.target.value })} placeholder="Ex: 12.5k" /></div>
                <div><Label>Descrição / Bio</Label><Input value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Descrição do canal" /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.ativo} onValueChange={v => setForm({ ...form, ativo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{YOUTUBE_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div><Label>Perfil *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="@nomedoperfil" /></div>
                <div><Label>Usuário / Email de Login</Label><Input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="email@exemplo.com" /></div>
                <div>
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input type={showFormPassword ? "text" : "password"} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground" onClick={() => setShowFormPassword(!showFormPassword)}>
                      {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div><Label>Seguidores</Label><Input value={form.seguidores} onChange={e => setForm({ ...form, seguidores: e.target.value })} placeholder="1.2k" /></div>
                <div><Label>Bio</Label><Input value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Descrição do perfil" /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status_aquecimento} onValueChange={v => setForm({ ...form, status_aquecimento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AQUECIMENTO_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Foto e Vínculo com Mapa (comum a todos) */}
            <div className="pt-3 border-t border-border/50 space-y-3">
              <div>
                <Label>Foto do card</Label>
                <div className="flex items-center gap-3 mt-1">
                  {form.foto_url ? (
                    <div className="relative">
                      <img src={form.foto_url} alt="preview" className="h-14 w-14 rounded-md object-cover border border-border" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setForm({ ...form, foto_url: "" })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-14 w-14 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                    <span className={`inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md border border-border hover:bg-secondary/50 ${uploading ? "opacity-50" : ""}`}>
                      <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : form.foto_url ? "Trocar" : "Enviar foto"}
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <Label>Vincular a nó do Mapa Mental</Label>
                <Select value={form.mapa_node_id || "__none__"} onValueChange={v => setForm({ ...form, mapa_node_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {mapNodes.map(n => <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save}>{editingConta ? "Atualizar" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
