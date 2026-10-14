import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from "lucide-react";

export interface WaGroupSlot {
  id: string;
  name: string;
  kind: "lancamento" | "relacionamento";
  inviteUrl: string;
  occupied: number;
  capacity: number;
  status: "active" | "full" | "standby";
}

const STORAGE_KEY = "imphq:wa_groups_rotator:v1";

const DEFAULT_GROUPS: WaGroupSlot[] = [
  {
    id: "grp-1",
    name: "🔥 Grupo VIP #01 · Lançamento (Silencioso)",
    kind: "lancamento",
    inviteUrl: "https://chat.whatsapp.com/ExemploGrupoVIP01",
    occupied: 245,
    capacity: 250,
    status: "full",
  },
  {
    id: "grp-2",
    name: "🔥 Grupo VIP #02 · Lançamento (Recebendo Tráfego)",
    kind: "lancamento",
    inviteUrl: "https://chat.whatsapp.com/ExemploGrupoVIP02",
    occupied: 142,
    capacity: 250,
    status: "active",
  },
  {
    id: "grp-3",
    name: "💎 Comunidade Relacionamento & Ofertas Relâmpago",
    kind: "relacionamento",
    inviteUrl: "https://chat.whatsapp.com/ExemploComunidadeVIP",
    occupied: 188,
    capacity: 500,
    status: "active",
  },
];

const QUICK_DISPATCH_TEMPLATES = [
  {
    id: "boas_vindas",
    label: "1. Boas-Vindas & Regra do Grupo",
    text: "🔥 Bem-vindo(a) ao Grupo Oficial! Este espaço é 100% silencioso para você receber em primeira mão o diagnóstico do mecanismo e o link do lote promocional. Fixe este grupo no topo do seu WhatsApp!",
  },
  {
    id: "enquete_dor",
    label: "2. Enquete Levantada de Mão (Pré-Oferta)",
    text: "📊 ENQUETE RÁPIDA: Se liberarmos amanhã às 09h apenas 15 unidades com condição de laboratório + frete grátis, qual opção faz mais sentido para você?\n\nResponda aqui ou mande 'EU QUERO' no meu privado para garantir prioridade!",
  },
  {
    id: "abertura_relampago",
    label: "3. Abertura de Carrinho / Oferta Relâmpago 24h",
    text: "🚨 LOTE LIBERADO PELAS PRÓXIMAS 24H!\n\nComo prometido para quem está neste grupo VIP, aqui está o link oficial com desconto máximo no Kit de 3 Potes + Frete Grátis + Garantia de 30 dias:\n👉 [LINK_CHECKOUT]\n\nQualquer dúvida sobre Pix ou parcelamento, me chame no privado agora!",
  },
  {
    id: "repescagem_x1",
    label: "4. Repescagem Individual X1 (Privado)",
    text: "Oi [Nome], tudo bem? Vi que você está lá no nosso Grupo VIP e acompanhou a liberação de hoje! Sobrou 1 reserva do lote com frete grátis e seguro de 30 dias — quer que eu segure no seu CPF para você finalizar no Pix ou cartão?",
  },
];

function readStoredGroups(): WaGroupSlot[] {
  if (typeof window === "undefined") return DEFAULT_GROUPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GROUPS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_GROUPS;
  } catch {
    return DEFAULT_GROUPS;
  }
}

export function WhatsAppGroupsOperationsPanel({ projectId }: { projectId?: string }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<WaGroupSlot[]>(readStoredGroups);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newKind, setNewKind] = useState<"lancamento" | "relacionamento">("lancamento");
  const [newCap, setNewCap] = useState(250);

  const [selectedTemplateId, setSelectedTemplateId] = useState("abertura_relampago");
  const [dispatchText, setDispatchText] = useState(QUICK_DISPATCH_TEMPLATES[2].text);
  const [targetPhone, setTargetPhone] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    } catch {
      /* ignore storage errors */
    }
  }, [groups]);

  // Active group in the rotator = first non-full group
  const activeRotatorGroup = useMemo(
    () =>
      groups.find((g) => g.occupied < g.capacity && g.status !== "full") ??
      groups[0] ??
      null,
    [groups]
  );

  const totalMembers = useMemo(
    () => groups.reduce((acc, g) => acc + g.occupied, 0),
    [groups]
  );
  const totalCapacity = useMemo(
    () => groups.reduce((acc, g) => acc + g.capacity, 0),
    [groups]
  );

  const handleAddGroup = () => {
    if (!newName.trim()) {
      toast.error("Informe o nome do grupo.");
      return;
    }
    const next: WaGroupSlot = {
      id: `grp-${Date.now().toString(36)}`,
      name: newName.trim(),
      kind: newKind,
      inviteUrl: newUrl.trim() || "https://chat.whatsapp.com/NovoGrupoVIP",
      occupied: 0,
      capacity: Math.max(10, Number(newCap) || 250),
      status: "active",
    };
    setGroups((prev) => [...prev, next]);
    setNewName("");
    setNewUrl("");
    toast.success(`Grupo "${next.name}" adicionado à rotação!`);
  };

  const handleSimulateLeadEntry = (id: string, delta: number) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const occupied = Math.max(0, Math.min(g.capacity, g.occupied + delta));
        const status: WaGroupSlot["status"] =
          occupied >= g.capacity - 5 ? "full" : "active";
        return { ...g, occupied, status };
      })
    );
  };

  const handleRemoveGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    toast.success("Grupo removido da rotação.");
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const found = QUICK_DISPATCH_TEMPLATES.find((t) => t.id === tplId);
    if (found) setDispatchText(found.text);
  };

  const handleDispatchWhatsApp = async () => {
    if (!dispatchText.trim()) {
      toast.error("Escreva a mensagem para disparo.");
      return;
    }
    setSendingWa(true);
    try {
      const cleanPhone = targetPhone.replace(/\D/g, "");
      if (cleanPhone.length >= 10) {
        const { error } = await supabase.functions.invoke("whatsapp-send", {
          body: {
            phone: cleanPhone,
            message: dispatchText,
            project_id: projectId && projectId !== "__all__" ? projectId : undefined,
          },
        });
        if (!error) {
          toast.success(`Mensagem disparada via Evolution API para ${cleanPhone}!`);
          setSendingWa(false);
          return;
        }
      }
      // Fallback: copy message and open WhatsApp /wa.me or /whatsapp hub
      await navigator.clipboard?.writeText(dispatchText);
      if (cleanPhone.length >= 10) {
        window.open(
          `https://wa.me/${cleanPhone}?text=${encodeURIComponent(dispatchText)}`,
          "_blank"
        );
        toast.success("Mensagem pronta aberta no WhatsApp!");
      } else {
        toast.success("Mensagem copiada! Abrindo central de atendimento WhatsApp...");
        navigate("/whatsapp");
      }
    } catch {
      navigator.clipboard?.writeText(dispatchText);
      toast.success("Mensagem copiada para a área de transferência!");
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Rotator & Capacity Control */}
      <div className="lg:col-span-7 rounded-xl border border-border bg-background/60 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Rotador de Links de Grupos (Lançamento & Relacionamento VIP)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Quando um grupo atinge 98% da lotação, o link único aponta automaticamente para o próximo grupo da fila.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono border-emerald-500/40 text-emerald-400">
            {totalMembers} / {totalCapacity} membros ({Math.round((totalMembers / Math.max(1, totalCapacity)) * 100)}%)
          </Badge>
        </div>

        {/* Active Smart Link Bar */}
        {activeRotatorGroup && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-emerald-500 text-slate-950 text-[10px]">
                  Link Ativo na Captação
                </Badge>
                <span className="text-xs font-bold text-foreground truncate">
                  {activeRotatorGroup.name}
                </span>
              </div>
              <p className="text-[11px] font-mono text-emerald-300 truncate">
                {activeRotatorGroup.inviteUrl} ({activeRotatorGroup.occupied}/{activeRotatorGroup.capacity} vagas)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] border-emerald-500/40"
                onClick={() => {
                  navigator.clipboard?.writeText(activeRotatorGroup.inviteUrl);
                  toast.success("Link do grupo ativo copiado!");
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar Link Ativo
              </Button>
            </div>
          </div>
        )}

        {/* Groups List */}
        <div className="space-y-2">
          {groups.map((grp) => {
            const pct = Math.min(100, Math.round((grp.occupied / Math.max(1, grp.capacity)) * 100));
            const isFull = grp.status === "full" || pct >= 98;
            return (
              <div
                key={grp.id}
                className="rounded-lg border border-border/80 bg-card p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className={
                        grp.kind === "lancamento"
                          ? "text-[10px] border-amber-500/40 text-amber-300"
                          : "text-[10px] border-sky-500/40 text-sky-300"
                      }
                    >
                      {grp.kind === "lancamento" ? "Lançamento" : "Relacionamento VIP"}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground truncate">
                      {grp.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={
                        isFull
                          ? "text-[10px] border-rose-500/40 text-rose-400"
                          : "text-[10px] border-emerald-500/40 text-emerald-400"
                      }
                    >
                      {isFull ? "Lotado (Rotacionado)" : "Recebendo Leads"}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {grp.occupied}/{grp.capacity} ({pct}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isFull ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[260px]">
                    <Link2 className="inline h-3 w-3 mr-1" />
                    {grp.inviteUrl}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleSimulateLeadEntry(grp.id, 10)}
                      title="Registrar +10 entradas no grupo"
                    >
                      +10 leads
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        navigator.clipboard?.writeText(grp.inviteUrl);
                        toast.success("Link de convite copiado!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-rose-400 hover:text-rose-300"
                      onClick={() => handleRemoveGroup(grp.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new group row */}
        <div className="rounded-lg border border-dashed border-border p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-4 space-y-1">
            <Label className="text-[10px]">Nome do Novo Grupo</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: 🔥 Grupo VIP #03"
              className="h-7 text-xs"
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <Label className="text-[10px]">Link chat.whatsapp.com</Label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="h-7 text-xs"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[10px]">Lotação Máx.</Label>
            <Input
              type="number"
              value={newCap}
              onChange={(e) => setNewCap(Number(e.target.value) || 250)}
              className="h-7 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" className="h-7 w-full text-xs" onClick={handleAddGroup}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Quick WhatsApp Group & X1 Dispatcher */}
      <div className="lg:col-span-5 rounded-xl border border-border bg-background/60 p-4 flex flex-col justify-between space-y-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Disparo Rápido · Grupo VIP & Repescagem X1
            </h3>
            <Badge variant="outline" className="text-[10px]">
              Evolution API / Direto
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_DISPATCH_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  selectedTemplateId === tpl.id
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 font-semibold"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Número / WhatsApp destino (opcional para teste/X1 individual)</Label>
            <Input
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              placeholder="Ex.: 5511999999999 (vazio = abrir central WhatsApp)"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Mensagem pronta para envio</Label>
            <Textarea
              value={dispatchText}
              onChange={(e) => setDispatchText(e.target.value)}
              rows={6}
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <Button
            size="sm"
            className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
            disabled={sendingWa}
            onClick={handleDispatchWhatsApp}
          >
            {sendingWa ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            Disparar no WhatsApp
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(dispatchText);
              toast.success("Mensagem copiada!");
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copiar Texto
          </Button>
        </div>
      </div>
    </div>
  );
}
