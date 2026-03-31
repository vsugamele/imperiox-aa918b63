import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  KeyRound, Plus, Search, Eye, EyeOff, Copy, ExternalLink, Pencil, Trash2, Globe
} from "lucide-react";
import { toast } from "sonner";

interface VaultItem {
  id: string;
  name: string;
  url: string | null;
  username: string | null;
  password_encrypted: string | null;
  category: string | null;
  notes: string | null;
  project_id: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "geral", label: "Geral", color: "bg-muted" },
  { value: "social", label: "Redes Sociais", color: "bg-violet-500/20 text-violet-400" },
  { value: "email", label: "E-mail", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "design", label: "Design", color: "bg-pink-500/20 text-pink-400" },
  { value: "ads", label: "Tráfego / Ads", color: "bg-amber-500/20 text-amber-400" },
  { value: "hosting", label: "Hosting / Domínios", color: "bg-cyan-500/20 text-cyan-400" },
  { value: "dev", label: "Desenvolvimento", color: "bg-blue-500/20 text-blue-400" },
  { value: "finance", label: "Financeiro", color: "bg-green-500/20 text-green-400" },
  { value: "other", label: "Outro", color: "bg-muted" },
];

const getCategoryInfo = (cat: string | null) =>
  CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

const emptyForm = { name: "", url: "", username: "", password_encrypted: "", category: "geral", notes: "", project_id: "" };

export default function Cofre() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    const [vaultRes, projRes] = await Promise.all([
      supabase.from("imphq_tools_vault").select("*").order("category").order("name"),
      supabase.from("imphq_projects").select("id, name"),
    ]);
    setItems((vaultRes.data as any[]) || []);
    setProjects((projRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = items.filter(item => {
    if (filterCat !== "all" && item.category !== filterCat) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: VaultItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      url: item.url || "",
      username: item.username || "",
      password_encrypted: item.password_encrypted || "",
      category: item.category || "geral",
      notes: item.notes || "",
      project_id: item.project_id || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      name: form.name.trim(),
      url: form.url || null,
      username: form.username || null,
      password_encrypted: form.password_encrypted || null,
      category: form.category,
      notes: form.notes || null,
      project_id: form.project_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await supabase.from("imphq_tools_vault").update(payload as any).eq("id", editingId);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Ferramenta atualizada");
    } else {
      const { error } = await supabase.from("imphq_tools_vault").insert(payload as any);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Ferramenta adicionada");
    }
    setDialogOpen(false);
    fetchData();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("imphq_tools_vault").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Removido");
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const togglePass = (id: string) =>
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Carregando...</div>;

  const grouped = CATEGORIES.filter(cat =>
    filterCat === "all" ? filtered.some(i => i.category === cat.value) : cat.value === filterCat
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <KeyRound className="h-7 w-7" /> Cofre de Ferramentas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sites, senhas e acessos do time</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ferramenta..." className="pl-9 bg-secondary" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44 bg-secondary">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma ferramenta cadastrada ainda.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar primeira
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(cat => {
            const catItems = filtered.filter(i => i.category === cat.value);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.value}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Badge className={cat.color}>{cat.label}</Badge>
                  <span className="text-xs">{catItems.length}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catItems.map(item => {
                    const proj = projects.find(p => p.id === item.project_id);
                    return (
                      <Card key={item.id} className="group hover:border-primary/30 transition-colors">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                              {item.name}
                            </CardTitle>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          {item.url && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span className="truncate flex-1">{item.url}</span>
                              <button onClick={() => copyText(item.url!, "URL")} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                              <a href={item.url} target="_blank" rel="noopener" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
                            </div>
                          )}
                          {item.username && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Usuário:</span>
                              <span className="font-mono">{item.username}</span>
                              <button onClick={() => copyText(item.username!, "Usuário")} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
                            </div>
                          )}
                          {item.password_encrypted && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Senha:</span>
                              <span className="font-mono">{showPasswords[item.id] ? item.password_encrypted : "••••••••"}</span>
                              <button onClick={() => togglePass(item.id)} className="text-muted-foreground hover:text-foreground">
                                {showPasswords[item.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                              <button onClick={() => copyText(item.password_encrypted!, "Senha")} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
                            </div>
                          )}
                          {item.notes && <p className="text-muted-foreground italic">{item.notes}</p>}
                          {proj && <Badge variant="outline" className="text-[10px]">{proj.name}</Badge>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ API GUIDE SECTION ═══ */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Guia da API — Império HQ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conecte IAs externas (Claude, GPT, n8n, Make) ao seu sistema. Use a API para criar tarefas, mover cards, gerenciar leads e mais.
          </p>

          {/* Base URL */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">URL Base</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input readOnly value="https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api?action=..." className="font-mono text-xs bg-secondary" />
              <Button size="sm" variant="outline" onClick={() => copyText("https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api", "URL Base")}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* How to connect */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">Como conectar uma IA externa</Label>
            <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>Gere uma API Key acima no Cofre (categoria "dev")</li>
              <li>Copie a URL base</li>
              <li>Passe o header <code className="text-primary">x-api-key: SUA_CHAVE</code></li>
              <li>Use <code className="text-primary">?action=NOME_DA_ACTION</code> na query string</li>
            </ol>
          </div>

          {/* Endpoints table */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">Endpoints disponíveis</Label>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Método</th>
                    <th className="text-left px-3 py-2 font-semibold">Action</th>
                    <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                    <th className="text-left px-3 py-2 font-semibold">Params</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["GET", "list_projects", "Lista projetos", "—"],
                    ["GET", "project_status", "Status do projeto + KPIs", "project_id"],
                    ["GET", "export_context", "Exporta contexto completo (avatar, branding...)", "project_id"],
                    ["GET", "list_columns", "Colunas do kanban", "board"],
                    ["GET", "list_cards", "Lista cards (filtros opcionais)", "board, column_id, project_id, priority"],
                    ["GET", "get_card", "Detalhe de um card", "card_id"],
                    ["GET", "list_leads", "Lista leads", "project_id, status, plataforma"],
                    ["GET", "list_skills", "Skills cadastradas", "—"],
                    ["GET", "get_skill", "Skill com system_prompt", "skill_id"],
                    ["POST", "create_task", "Cria card no kanban", "title, board, priority, due_date, project_id"],
                    ["POST", "create_lead", "Cria lead", "nome, email, phone, plataforma, project_id"],
                    ["POST", "create_notification", "Cria notificação", "title, message, type, link"],
                    ["PUT", "update_card", "Atualiza card", "card_id + campos"],
                    ["PUT", "move_card", "Move card entre colunas", "card_id, column_id ou column_title+board"],
                    ["PUT", "update_lead", "Atualiza lead", "lead_id + campos"],
                    ["DELETE", "delete_card", "Deleta card", "card_id"],
                  ].map(([method, act, desc, params], i) => (
                    <tr key={i} className="hover:bg-secondary/30">
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className={`text-[9px] ${
                          method === "GET" ? "text-emerald-400 border-emerald-400/30" :
                          method === "POST" ? "text-blue-400 border-blue-400/30" :
                          method === "PUT" ? "text-amber-400 border-amber-400/30" :
                          "text-red-400 border-red-400/30"
                        }`}>{method}</Badge>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-primary">{act}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{desc}</td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono text-[10px]">{params}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Curl example */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">Exemplo curl</Label>
            <pre className="mt-1 text-[11px] bg-secondary/50 border border-border rounded-lg p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap">{`# Listar projetos
curl -H "x-api-key: SUA_CHAVE" \\
  "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api?action=list_projects"

# Criar tarefa
curl -X POST -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"title":"Revisar copy do lançamento","board":"humanas","priority":"high"}' \\
  "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api?action=create_task"

# Mover card
curl -X PUT -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"card_id":"UUID","column_title":"done","board":"humanas"}' \\
  "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api?action=move_card"

# Exportar contexto do projeto
curl -H "x-api-key: SUA_CHAVE" \\
  "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api?action=export_context&project_id=UUID"`}
            </pre>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => {
              copyText(`curl -H "x-api-key: SUA_CHAVE" "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/imperio-api?action=list_projects"`, "Exemplo");
            }}>
              <Copy className="h-3 w-3 mr-1" /> Copiar exemplo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Ferramenta" : "Nova Ferramenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Canva Pro" /></div>
            <div><Label>URL</Label><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Usuário / E-mail</Label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
              <div><Label>Senha</Label><div className="relative"><Input type={showPasswords ? "text" : "password"} value={form.password_encrypted} onChange={e => setForm(f => ({ ...f, password_encrypted: e.target.value }))} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowPasswords(!showPasswords)}>{showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto (opcional)</Label>
                <Select value={form.project_id || "none"} onValueChange={v => setForm(f => ({ ...f, project_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
