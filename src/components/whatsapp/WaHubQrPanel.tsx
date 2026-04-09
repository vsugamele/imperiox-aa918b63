import { useState } from "react";
import { useWaSession, UiStatus } from "@/hooks/useWaSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { QrCode, RefreshCw, Loader2, Wifi, WifiOff, AlertCircle, Radio, ChevronDown, RotateCcw, Bug, Trash2 } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<UiStatus, { label: string; color: string; icon: typeof Wifi }> = {
  idle: { label: "Inativo", color: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  pending: { label: "Processando...", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Loader2 },
  awaiting_qr: { label: "Aguardando QR", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Loader2 },
  qr_ready: { label: "QR Pronto", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: QrCode },
  connected: { label: "Conectado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Wifi },
  stale: { label: "Sessão Travada", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertCircle },
  error: { label: "Erro", color: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertCircle },
  resetting: { label: "Limpando...", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Loader2 },
};

const WA_PROJECTS = [
  { value: "igaming", label: "iGaming" },
  { value: "forex", label: "Forex" },
  { value: "eu", label: "EU Encapsulados" },
  { value: "crypto", label: "Crypto" },
  { value: "imobiliario", label: "Imobiliário" },
];

export default function WaHubQrPanel() {
  const [tenantId, setTenantId] = useState("default");
  const [sessionKey, setSessionKey] = useState("");
  const [project, setProject] = useState("igaming");
  const [showDiag, setShowDiag] = useState(false);

  const {
    uiStatus,
    qrImageUrl,
    qrText,
    errorMessage,
    canGenerateQr,
    startGetQr,
    resetSession,
    sessionRawStatus,
    diagnostics,
  } = useWaSession({
    tenantId,
    sessionKey: sessionKey || "default-session",
    project,
  });

  const cfg = statusConfig[uiStatus];
  const StatusIcon = cfg.icon;

  const handleNewSessionKey = () => {
    setSessionKey(`session-${Date.now()}`);
  };

  const handleResetSession = async () => {
    await resetSession();
    toast.success("Sessão limpa. Pode gerar um novo QR.");
  };

  const showResetButton = ["stale", "error", "connected", "qr_ready"].includes(uiStatus) ||
    diagnostics.hasSession === true ||
    (diagnostics.reason === "qr_timeout");

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" /> Hub Local — WhatsApp
          <Badge variant="outline" className={`ml-auto text-[10px] ${cfg.color}`}>
            <StatusIcon className={`h-3 w-3 mr-1 ${["pending", "awaiting_qr", "resetting"].includes(uiStatus) ? "animate-spin" : ""}`} />
            {cfg.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Tenant ID</Label>
            <Input
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              placeholder="default"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Session Key</Label>
            <div className="flex gap-1">
              <Input
                value={sessionKey}
                onChange={e => setSessionKey(e.target.value)}
                placeholder="minha-sessao"
                className="h-8 text-xs"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleNewSessionKey}
                title="Gerar nova session key"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Projeto</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WA_PROJECTS.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* QR Area */}
        <div className="flex flex-col items-center gap-4">
          {/* RESETTING */}
          {uiStatus === "resetting" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-amber-400 font-medium">Limpando sessão...</p>
                <p className="text-[10px] text-muted-foreground mt-1">Removendo dados anteriores</p>
              </div>
            </div>
          )}

          {/* PENDING */}
          {uiStatus === "pending" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center rounded-xl border border-border bg-muted/30">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Aguardando worker local...</p>
                <p className="text-[10px] text-muted-foreground mt-1">Comando enviado, processando</p>
              </div>
            </div>
          )}

          {/* AWAITING_QR */}
          {uiStatus === "awaiting_qr" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto mb-2" />
                <p className="text-xs text-blue-400 font-medium">Gerando QR...</p>
                <p className="text-[10px] text-muted-foreground mt-1">Worker respondeu, aguardando imagem</p>
                {(diagnostics.pollCount ?? 0) * 2.5 > 30 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 text-[10px] h-7 text-orange-400 border-orange-500/30"
                    onClick={handleResetSession}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Limpar e tentar de novo
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* QR_READY: image */}
          {uiStatus === "qr_ready" && qrImageUrl && (
            <div className="bg-background p-3 rounded-xl border border-emerald-500/20">
              <img
                src={
                  qrImageUrl.startsWith("data:") ? qrImageUrl
                  : qrImageUrl.startsWith("http") ? qrImageUrl
                  : `data:image/png;base64,${qrImageUrl}`
                }
                alt="QR Code"
                className="w-[250px] h-[250px] rounded-lg"
              />
            </div>
          )}

          {/* QR_READY: text only */}
          {uiStatus === "qr_ready" && !qrImageUrl && qrText && (
            <div className="w-[250px] min-h-[100px] p-4 bg-muted rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">QR Text (copie para o app):</p>
              <p className="text-xs font-mono break-all select-all">{qrText}</p>
            </div>
          )}

          {/* CONNECTED */}
          {uiStatus === "connected" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <div className="text-center">
                <Wifi className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-400">WhatsApp Conectado</p>
                <p className="text-[10px] text-muted-foreground mt-1">via Hub Local (Baileys)</p>
              </div>
            </div>
          )}

          {/* STALE */}
          {uiStatus === "stale" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-orange-500/5 rounded-xl border border-orange-500/20">
              <div className="text-center px-4">
                <AlertCircle className="h-10 w-10 text-orange-400 mx-auto mb-2" />
                <p className="text-xs text-orange-400 font-medium">Sessão Travada</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  O worker respondeu mas não gerou QR. A sessão pode estar suja.
                </p>
                <div className="flex flex-col gap-1 mt-3">
                  <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={handleResetSession}>
                    <Trash2 className="h-3 w-3 mr-1" /> Limpar Sessão
                  </Button>
                  <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={handleNewSessionKey}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Nova Session Key
                  </Button>
                  <p className="text-[9px] text-muted-foreground">ou reinicie o worker local</p>
                </div>
              </div>
            </div>
          )}

          {/* ERROR */}
          {uiStatus === "error" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-destructive/5 rounded-xl border border-destructive/20">
              <div className="text-center px-4">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                <p className="text-xs text-destructive font-medium">Erro</p>
                <p className="text-[10px] text-muted-foreground mt-1">{errorMessage || "Falha ao obter QR"}</p>
              </div>
            </div>
          )}

          {/* IDLE */}
          {uiStatus === "idle" && (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-muted/30 rounded-xl border border-border border-dashed">
              <div className="text-center">
                <QrCode className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Clique em "Gerar QR" para começar</p>
              </div>
            </div>
          )}

          {/* Helper text */}
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {uiStatus === "connected"
              ? "Sessão ativa via worker local"
              : uiStatus === "qr_ready"
              ? "Escaneie com seu WhatsApp para conectar"
              : uiStatus === "stale"
              ? "Tente uma nova session key ou reinicie o worker"
              : uiStatus === "pending"
              ? "O worker local precisa estar rodando na sua máquina"
              : uiStatus === "awaiting_qr"
              ? "Worker respondeu, gerando imagem do QR..."
              : uiStatus === "resetting"
              ? "Limpando sessão anterior..."
              : "Certifique-se que o worker local está ativo antes de gerar o QR"}
          </p>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={startGetQr}
              disabled={!canGenerateQr || !sessionKey.trim()}
            >
              {uiStatus === "pending" ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Aguardando...</>
              ) : (
                <><RefreshCw className="h-3 w-3 mr-1" /> Gerar QR</>
              )}
            </Button>
            {showResetButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetSession}
                className="text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Limpar Sessão
              </Button>
            )}
          </div>

          {/* Diagnostics */}
          {(sessionRawStatus || diagnostics.commandStatus) && (
            <Collapsible open={showDiag} onOpenChange={setShowDiag}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1 text-muted-foreground">
                  <Bug className="h-3 w-3" /> Diagnóstico
                  <ChevronDown className={`h-3 w-3 transition-transform ${showDiag ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border text-[10px] font-mono space-y-1 max-w-xs">
                  {sessionRawStatus && <div>session.status: <span className="text-primary">{sessionRawStatus}</span></div>}
                  {diagnostics.commandStatus && <div>command.status: <span className="text-primary">{diagnostics.commandStatus}</span></div>}
                  {diagnostics.hasSession !== undefined && <div>hasSession: <span className={diagnostics.hasSession ? "text-emerald-400" : "text-destructive"}>{String(diagnostics.hasSession)}</span></div>}
                  {diagnostics.needsQr !== undefined && <div>needsQr: <span className="text-primary">{String(diagnostics.needsQr)}</span></div>}
                  {diagnostics.qrAvailable !== undefined && <div>qrAvailable: <span className={diagnostics.qrAvailable ? "text-emerald-400" : "text-orange-400"}>{String(diagnostics.qrAvailable)}</span></div>}
                  {diagnostics.qrAt && <div>qrAt: {diagnostics.qrAt}</div>}
                  {diagnostics.instructions && <div className="text-muted-foreground break-words">instructions: {diagnostics.instructions}</div>}
                  {diagnostics.reason && <div className="text-destructive">reason: {diagnostics.reason}</div>}
                  {diagnostics.pollCount !== undefined && <div>polls: {diagnostics.pollCount}</div>}
                  {diagnostics.commandId && <div className="text-muted-foreground truncate">cmdId: {diagnostics.commandId}</div>}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
