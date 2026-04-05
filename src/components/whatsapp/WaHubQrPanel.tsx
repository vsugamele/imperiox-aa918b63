import { useState } from "react";
import { useWaSession, UiStatus } from "@/hooks/useWaSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, RefreshCw, Loader2, Wifi, WifiOff, AlertCircle, Radio } from "lucide-react";

const statusConfig: Record<UiStatus, { label: string; color: string; icon: typeof Wifi }> = {
  idle: { label: "Inativo", color: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  pending: { label: "Processando...", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Loader2 },
  awaiting_qr: { label: "QR Disponível", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: QrCode },
  connected: { label: "Conectado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Wifi },
  error: { label: "Erro", color: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertCircle },
};

export default function WaHubQrPanel() {
  const [tenantId, setTenantId] = useState("default");
  const [sessionKey, setSessionKey] = useState("");

  const {
    uiStatus,
    qrImageUrl,
    qrText,
    errorMessage,
    canGenerateQr,
    startGetQr,
    sessionRawStatus,
  } = useWaSession({
    tenantId,
    sessionKey: sessionKey || "default-session",
  });

  const cfg = statusConfig[uiStatus];
  const StatusIcon = cfg.icon;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" /> Hub Local — WhatsApp
          <Badge variant="outline" className={`ml-auto text-[10px] ${cfg.color}`}>
            <StatusIcon className={`h-3 w-3 mr-1 ${uiStatus === "pending" ? "animate-spin" : ""}`} />
            {cfg.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config */}
        <div className="grid grid-cols-2 gap-3">
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
            <Input
              value={sessionKey}
              onChange={e => setSessionKey(e.target.value)}
              placeholder="minha-sessao"
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* QR Area */}
        <div className="flex flex-col items-center gap-4">
          {uiStatus === "pending" ? (
            <div className="w-[250px] h-[250px] flex items-center justify-center rounded-xl border border-border bg-muted/30">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Aguardando worker local...</p>
              </div>
            </div>
          ) : uiStatus === "connected" ? (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <div className="text-center">
                <Wifi className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-400">WhatsApp Conectado</p>
                <p className="text-[10px] text-muted-foreground mt-1">via Hub Local (Baileys)</p>
              </div>
            </div>
          ) : qrImageUrl ? (
            <div className="bg-background p-3 rounded-xl border border-border">
              <img
                src={qrImageUrl.startsWith("data:") ? qrImageUrl : `data:image/png;base64,${qrImageUrl}`}
                alt="QR Code"
                className="w-[250px] h-[250px] rounded-lg"
              />
            </div>
          ) : qrText ? (
            <div className="w-[250px] min-h-[100px] p-4 bg-muted rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">QR Text (copie para o app):</p>
              <p className="text-xs font-mono break-all select-all">{qrText}</p>
            </div>
          ) : uiStatus === "error" ? (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-destructive/5 rounded-xl border border-destructive/20">
              <div className="text-center px-4">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                <p className="text-xs text-destructive font-medium">Erro</p>
                <p className="text-[10px] text-muted-foreground mt-1">{errorMessage || "Falha ao obter QR"}</p>
              </div>
            </div>
          ) : (
            <div className="w-[250px] h-[250px] flex items-center justify-center bg-muted/30 rounded-xl border border-border border-dashed">
              <div className="text-center">
                <QrCode className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Clique em "Gerar QR" para começar</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {uiStatus === "connected"
              ? "Sessão ativa via worker local"
              : uiStatus === "awaiting_qr"
              ? "Escaneie com seu WhatsApp para conectar"
              : uiStatus === "pending"
              ? "O worker local precisa estar rodando na sua máquina"
              : "Certifique-se que o worker local está ativo antes de gerar o QR"}
          </p>

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

          {sessionRawStatus && (
            <p className="text-[10px] text-muted-foreground">
              Status raw: <span className="font-mono">{sessionRawStatus}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
