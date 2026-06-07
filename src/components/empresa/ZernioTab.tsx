import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Pencil, Eye, EyeOff, KeyRound, Mail, Instagram,
  Music2, Youtube, CreditCard, Sparkles, Copy, Check, Search, X
} from "lucide-react";
import { toast } from "sonner";

interface ZernioLinkedAccount {
  id?: string;
  type: "email" | "instagram" | "tiktok" | "youtube" | "ads" | "custom";
  name: string;
}

interface ZernioAccount {
  id: string;
  nome: string; // Email do Zernio
  tipo: "zernio";
  valor: string; // Chave/Token
  extra?: {
    contas?: ZernioLinkedAccount[];
  };
  created_at?: string;
}

interface SelectableAccount {
  id: string;
  name: string;
  type: "email" | "instagram" | "tiktok" | "youtube" | "ads";
}

export function ZernioTab() {
  const [zernios, setZernios] = useState<ZernioAccount[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<SelectableAccount[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingZernio, setEditingZernio] = useState<ZernioAccount | null>(null);
  
  // Form state
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [selectedLinked, setSelectedLinked] = useState<ZernioLinkedAccount[]>([]);
  const [customAccountText, setCustomAccountText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(false);
  
  // UI state
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    try {
      // Fetch Zernio accounts
      const { data, error } = await supabase
        .from("imphq_empresa")
        .select("*")
        .eq("tipo", "zernio")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setZernios((data || []) as ZernioAccount[]);
    } catch (err: any) {
      toast.error("Erro ao carregar dados do Zernio: " + err.message);
    }
  };

  const loadAvailable = async () => {
    try {
      // 1. Fetch empresa accounts (except Zernio itself)
      const { data: empresaData } = await supabase
        .from("imphq_empresa")
        .select("id, nome, tipo")
        .neq("tipo", "zernio");

      // 2. Fetch ad accounts
      const { data: adsData } = await supabase
        .from("imphq_ad_accounts")
        .select("id, nome");

      const formatted: SelectableAccount[] = [];

      if (empresaData) {
        empresaData.forEach((item) => {
          if (["email", "instagram", "tiktok", "youtube"].includes(item.tipo)) {
            formatted.push({
              id: item.id,
              name: item.tipo === "instagram" || item.tipo === "tiktok" ? `@${item.nome}` : item.nome,
              type: item.tipo as any,
            });
          }
        });
      }

      if (adsData) {
        adsData.forEach((item) => {
          formatted.push({
            id: item.id,
            name: item.nome,
            type: "ads",
          });
        });
      }

      setAvailableAccounts(formatted);
    } catch (err: any) {
      console.error("Erro ao carregar contas disponíveis: ", err);
    }
  };

  useEffect(() => {
    load();
    loadAvailable();
  }, []);

  const openAdd = () => {
    setEditingZernio(null);
    setEmail("");
    setToken("");
    setSelectedLinked([]);
    setCustomAccountText("");
    setSearchTerm("");
    setShowFormPassword(false);
    setShowDialog(true);
  };

  const openEdit = (z: ZernioAccount) => {
    setEditingZernio(z);
    setEmail(z.nome);
    setToken(z.valor);
    setSelectedLinked(z.extra?.contas || []);
    setCustomAccountText("");
    setSearchTerm("");
    setShowFormPassword(false);
    setShowDialog(true);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Token copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addCustomAccount = () => {
    if (!customAccountText.trim()) return;
    
    // Check if already added
    const text = customAccountText.trim();
    if (selectedLinked.some(acc => acc.name.toLowerCase() === text.toLowerCase())) {
      toast.error("Esta conta já foi associada.");
      return;
    }

    setSelectedLinked(prev => [
      ...prev,
      { type: "custom", name: text }
    ]);
    setCustomAccountText("");
  };

  const toggleAccountSelection = (acc: SelectableAccount) => {
    const isSelected = selectedLinked.some(item => item.id === acc.id);
    if (isSelected) {
      setSelectedLinked(prev => prev.filter(item => item.id !== acc.id));
    } else {
      setSelectedLinked(prev => [
        ...prev,
        { id: acc.id, type: acc.type, name: acc.name }
      ]);
    }
  };

  const removeLinkedAccount = (name: string) => {
    setSelectedLinked(prev => prev.filter(item => item.name !== name));
  };

  const save = async () => {
    if (!email.trim() || !token.trim()) {
      toast.error("E-mail e Chave API/Token são obrigatórios");
      return;
    }

    const payload = {
      nome: email.trim(),
      tipo: "zernio",
      valor: token.trim(),
      extra: {
        contas: selectedLinked,
      },
    };

    try {
      if (editingZernio) {
        const { error } = await supabase
          .from("imphq_empresa")
          .update(payload)
          .eq("id", editingZernio.id);

        if (error) throw error;
        toast.success("Organizador Zernio atualizado!");
      } else {
        const { error } = await supabase
          .from("imphq_empresa")
          .insert(payload);

        if (error) throw error;
        toast.success("Chave Zernio registrada!");
      }
      setShowDialog(false);
      load();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("imphq_empresa")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Registro Zernio removido!");
      load();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const getAccountBadgeStyle = (type: string) => {
    switch (type) {
      case "ads":
        return "border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20";
      case "instagram":
        return "border-pink-500/30 text-pink-400 bg-pink-500/10 hover:bg-pink-500/20";
      case "tiktok":
        return "border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20";
      case "youtube":
        return "border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20";
      case "email":
        return "border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20";
      default:
        return "border-violet-500/30 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20";
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "ads":
        return <CreditCard className="h-3 w-3 mr-1" />;
      case "instagram":
        return <Instagram className="h-3 w-3 mr-1" />;
      case "tiktok":
        return <Music2 className="h-3 w-3 mr-1" />;
      case "youtube":
        return <Youtube className="h-3 w-3 mr-1" />;
      case "email":
        return <Mail className="h-3 w-3 mr-1" />;
      default:
        return <Sparkles className="h-3 w-3 mr-1" />;
    }
  };

  const filteredAvailable = availableAccounts.filter(acc =>
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Gerencie e organize suas credenciais do Zernio mapeando quais e-mails e chaves estão sendo usados para bater nas suas contas.
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Credencial
        </Button>
      </div>

      {zernios.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma credencial Zernio cadastrada</p>
          <p className="text-xs">Registre suas chaves do Zernio para mapear as contas correspondentes</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">E-mail do Zernio</TableHead>
                <TableHead className="text-[10px] uppercase">Chave / Token API</TableHead>
                <TableHead className="text-[10px] uppercase">Contas Vinculadas</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zernios.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {z.nome}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">
                        {visibleTokens[z.id] ? z.valor : "••••••••••••••••"}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => toggleTokenVisibility(z.id)}>
                        {visibleTokens[z.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleCopy(z.id, z.valor)}>
                        {copiedId === z.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 max-w-[500px]">
                      {z.extra?.contas && z.extra.contas.length > 0 ? (
                        z.extra.contas.map((acc, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className={`text-[10px] py-0.5 px-2 flex items-center ${getAccountBadgeStyle(acc.type)}`}
                          >
                            {getAccountIcon(acc.type)}
                            {acc.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nenhuma conta vinculada</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(z)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => remove(z.id)}>
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

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingZernio ? "Editar" : "Adicionar"} Credencial Zernio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>E-mail Zernio *</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: zernio1@email.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Chave API / Token *</Label>
                <div className="relative">
                  <Input
                    type={showFormPassword ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Chave do Zernio"
                    className="font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                  >
                    {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Linked Accounts Section */}
            <div className="space-y-2">
              <Label>Contas Associadas a esta Credencial</Label>
              
              {/* Selected badge view */}
              <div className="p-2 border border-dashed border-border rounded-lg min-h-[44px] flex flex-wrap gap-1.5 bg-secondary/20">
                {selectedLinked.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic self-center px-1">Selecione contas abaixo ou insira personalizadas</span>
                ) : (
                  selectedLinked.map((item, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className={`text-[10px] py-0.5 pl-2 pr-1 flex items-center ${getAccountBadgeStyle(item.type)}`}
                    >
                      {getAccountIcon(item.type)}
                      {item.name}
                      <button
                        type="button"
                        onClick={() => removeLinkedAccount(item.name)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>

              {/* Add Custom / Search existing */}
              <div className="grid grid-cols-5 gap-2 items-end pt-1">
                <div className="col-span-3 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Adicionar Conta Customizada (Texto Livre)</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={customAccountText}
                      onChange={(e) => setCustomAccountText(e.target.value)}
                      placeholder="Ex: Instagram do Theo"
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomAccount();
                        }
                      }}
                    />
                    <Button type="button" size="sm" className="h-8 px-2" onClick={addCustomAccount}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Buscar Contas Cadastradas</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar..."
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Selection list */}
              <div className="border border-border rounded-lg max-h-[160px] overflow-y-auto divide-y divide-border/60">
                {filteredAvailable.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Nenhuma conta cadastrada encontrada
                  </div>
                ) : (
                  filteredAvailable.map((acc) => {
                    const isSelected = selectedLinked.some(item => item.id === acc.id);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => toggleAccountSelection(acc)}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-secondary/40 transition-colors ${
                          isSelected ? "bg-primary/5 text-primary" : ""
                        }`}
                      >
                        <div className="flex items-center">
                          {getAccountIcon(acc.type)}
                          <span className="font-medium">{acc.name}</span>
                          <span className="ml-2 text-[9px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {acc.type === "ads" ? "Ad Account" : acc.type}
                          </span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save}>
              {editingZernio ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
