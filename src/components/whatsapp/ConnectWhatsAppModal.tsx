import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Smartphone,
  Wifi,
  PowerOff,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface ProviderInput {
  id?: string;
  instance_name?: string | null;
  project_id?: string;
  display_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string }[];
  provider?: ProviderInput | null;
  onSuccess?: (info: { instance: string; phone?: string | null }) => void;
}

export default function ConnectWhatsAppModal({
  open,
  onOpenChange,
  projects,
  provider,
  onSuccess,
}: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [instanceName, setInstanceName] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "waiting_scan" | "connected" | "error">("idle");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar formulário quando o modal abre
  useEffect(() => {
    if (!open) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setQrCode(null);
      setStatus("idle");
      setConnectedPhone(null);
      setErrorMessage(null);
      setPollCount(0);
      return;
    }

    const initialProjectId = provider?.project_id || projects[0]?.id || "";
    setSelectedProjectId(initialProjectId);

    let initialName = provider?.instance_name || "";
    if (!initialName && initialProjectId) {
      initialName = `imp_${initialProjectId.replace(/[^a-zA-Z0-9]/g, "")}`;
    } else if (!initialName) {
      initialName = `imp_${Date.now().toString().slice(-6)}`;
    }
    if (!initialName.startsWith("imp_")) {
      initialName = `imp_${initialName}`;
    }

    setInstanceName(initialName);
    setDisplayName(provider?.display_name || "");

    // Se já tiver provider, gera o QR imediatamente
    gerarQrCode(initialName, initialProjectId, provider?.id, provider?.display_name || "");
  }, [open, provider, projects]);

  const pararPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checarStatus = useCallback(async (inst: string) => {
    try {
      setPollCount((prev) => prev + 1);
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: {
          action: "checar_status",
          instance: inst,
        },
      });

      if (error) throw error;

      if (data?.connected || data?.status === "open" || data?.state === "open") {
        pararPolling();
        setStatus("connected");
        setConnectedPhone(data.phone || null);
        toast.success("WhatsApp conectado com sucesso!");
        if (onSuccess) {
          onSuccess({ instance: inst, phone: data.phone || null });
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn("[ConnectWhatsAppModal] Erro no polling de status:", err);
      return false;
    }
  }, [onSuccess]);

  const iniciarPolling = (inst: string) => {
    pararPolling();
    // Inicia intervalo de polling a cada 2.5s (2500ms)
    pollingRef.current = setInterval(async () => {
      await checarStatus(inst);
    }, 2500);
  };

  const gerarQrCode = async (
    targetInstance?: string,
    targetProjectId?: string,
    targetProviderId?: string,
    targetDisplayName?: string
  ) => {
    const inst = targetInstance || instanceName;
    const proj = targetProjectId || selectedProjectId;
    const pId = targetProviderId || provider?.id;
    const dName = targetDisplayName || displayName;

    if (!inst) {
      toast.error("Informe o nome da instância.");
      return;
    }

    pararPolling();
    setStatus("generating");
    setErrorMessage(null);
    setQrCode(null);
    setPollCount(0);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: {
          action: "gerar_qrcode",
          instance: inst,
          project_id: proj,
          provider_id: pId,
          display_name: dName,
        },
      });

      if (error) throw error;

      if (data?.success && data?.qrcode) {
        setQrCode(data.qrcode);
        setStatus("waiting_scan");
        // Inicia verificação contínua a cada 2.5s
        iniciarPolling(inst);
      } else if (data?.status === "open") {
        setStatus("connected");
        setConnectedPhone(data.phone || null);
        toast.success("Esta instância já está conectada!");
        if (onSuccess) {
          onSuccess({ instance: inst, phone: data.phone || null });
        }
      } else {
        throw new Error(data?.error || "Não foi possível obter o QR Code.");
      }
    } catch (err: any) {
      console.error("[ConnectWhatsAppModal] Erro ao gerar QR:", err);
      setStatus("error");
      setErrorMessage(err?.message || "Erro ao conectar com a Evolution API.");
      toast.error("Erro ao gerar QR Code");
    }
  };

  const desconectar = async () => {
    if (!instanceName) return;
    pararPolling();
    try {
      const { error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: {
          action: "desconectar",
          instance: instanceName,
        },
      });
      if (error) throw error;
      setStatus("idle");
      setQrCode(null);
      setConnectedPhone(null);
      toast.success("Instância desconectada.");
      if (onSuccess) {
        onSuccess({ instance: instanceName, phone: null });
      }
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + (err.message || String(err)));
    }
  };

  // Limpeza de timeout ao desmontar
  useEffect(() => {
    return () => pararPolling();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0A0B0D] border border-[#1B1E23] text-foreground p-6 shadow-2xl rounded-xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-[#1B1E23]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white tracking-tight">
                  Conectar WhatsApp
                </DialogTitle>
                <DialogDescription className="text-xs text-[#8A8F98]">
                  Evolution API · Multi-instância isolada
                </DialogDescription>
              </div>
            </div>
            {status === "connected" ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conectado
              </Badge>
            ) : status === "waiting_scan" ? (
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Aguardando leitura
              </Badge>
            ) : null}
          </div>
        </DialogHeader>

        {/* Configurações básicas se for nova instância */}
        {!provider && status !== "connected" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8A8F98] uppercase tracking-wider font-mono">
                Projeto
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={(val) => {
                  setSelectedProjectId(val);
                  const clean = val.replace(/[^a-zA-Z0-9]/g, "");
                  setInstanceName(`imp_${clean}`);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-[#111317] border-[#1B1E23] text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-[#111317] border-[#1B1E23]">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs text-white">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-[#8A8F98] uppercase tracking-wider font-mono">
                Nome da Instância
              </Label>
              <Input
                value={instanceName}
                onChange={(e) => {
                  let val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                  if (!val.startsWith("imp_")) val = `imp_${val.replace(/^imp_*/, "")}`;
                  setInstanceName(val);
                }}
                className="h-8 text-xs font-mono bg-[#111317] border-[#1B1E23] text-white"
                placeholder="imp_vendas"
              />
            </div>
          </div>
        )}

        {/* Corpo principal: QR Code / Estados */}
        <div className="py-4 flex flex-col items-center justify-center min-h-[300px]">
          {status === "generating" && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
              <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
              <p className="text-sm font-medium text-white">Criando instância e gerando QR Code...</p>
              <p className="text-xs text-[#8A8F98]">Conectando com o servidor Evolution API</p>
            </div>
          )}

          {status === "waiting_scan" && qrCode && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="relative p-3 bg-white rounded-2xl shadow-xl border border-white/10">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-[230px] h-[230px] object-contain rounded-lg"
                />
              </div>

              {/* Status de Polling a cada 2.5s */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111317] border border-[#1B1E23] text-[11px] font-mono text-[#8A8F98]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Verificando conexão a cada 2.5s ({pollCount})</span>
              </div>

              {/* Instruções de conexão */}
              <div className="w-full bg-[#111317] border border-[#1B1E23] rounded-lg p-3 text-xs text-[#8A8F98] space-y-1.5">
                <div className="flex items-start gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Como conectar:</strong>
                    <ol className="list-decimal list-inside space-y-0.5 mt-1 text-[11px]">
                      <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                      <li>Vá em <strong>Aparelhos Conectados</strong></li>
                      <li>Toque em <strong>Conectar Aparelho</strong> e aponte para a tela</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === "connected" && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-6 w-full">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h4 className="text-base font-semibold text-white">WhatsApp Conectado!</h4>
              <p className="text-xs text-[#8A8F98] max-w-xs">
                Sua instância <strong className="text-white font-mono">{instanceName}</strong> está pronta para enviar e receber mensagens com automação IA.
              </p>
              {connectedPhone && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono text-xs">
                  <Wifi className="h-3.5 w-3.5" />
                  <span>+{connectedPhone}</span>
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-rose-300">Falha ao carregar QR Code</p>
              <p className="text-xs text-[#8A8F98] max-w-xs">{errorMessage || "Tente novamente."}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => gerarQrCode()}
                className="mt-2 text-xs border-[#1B1E23] text-white"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Tentar Novamente
              </Button>
            </div>
          )}

          {status === "idle" && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#8A8F98]">
                <QrCode className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-white">Pronto para gerar conexão</p>
              <p className="text-xs text-[#8A8F98] max-w-xs">
                Clique no botão abaixo para gerar o QR Code oficial da Evolution API.
              </p>
              <Button
                size="sm"
                onClick={() => gerarQrCode()}
                className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5" /> Gerar QR Code
              </Button>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <DialogFooter className="flex items-center justify-between border-t border-[#1B1E23] pt-3 sm:justify-between">
          <div className="flex items-center gap-2">
            {status === "connected" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={desconectar}
                className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <PowerOff className="h-3 w-3 mr-1.5" /> Desconectar
              </Button>
            )}
            {status === "waiting_scan" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => gerarQrCode()}
                className="h-8 text-xs text-[#8A8F98] hover:text-white"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Novo QR Code
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs border-[#1B1E23] text-white hover:bg-[#111317]"
            >
              {status === "connected" ? "Concluir" : "Fechar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
