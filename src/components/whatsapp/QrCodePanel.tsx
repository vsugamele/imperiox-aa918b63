import type { Tables } from "@/integrations/supabase/types";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, RefreshCw, Loader2, Wifi, WifiOff } from "lucide-react";

interface Props {
  provider: Pick<Tables<"imphq_wa_providers">, "id" | "instance_name">;
}

export default function QrCodePanel({ provider }: Props) {
  const [qrData, setQrData] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("unknown");
  const [loading, setLoading] = useState(false);

  const fetchQr = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `whatsapp-api?action=qr_code&provider_id=${provider.id}`,
        { method: "GET" }
      );
      if (error) throw error;
      // Evolution returns base64 QR or pairingCode
      const base64 = data?.qrcode?.base64 || data?.qrcode?.qrcode?.base64 || null;
      setQrData(base64);
    } catch (err: unknown) {
      console.error("QR fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [provider.id]);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke(
        `whatsapp-api?action=session_status&provider_id=${provider.id}`,
        { method: "GET" }
      );
      const state = data?.state?.instance?.state || data?.state?.state || data?.status || "unknown";
      setStatus(state);
      return state;
    } catch {
      setStatus("error");
      return "error";
    }
  }, [provider.id]);

  useEffect(() => {
    fetchQr();
    fetchStatus();
    const interval = setInterval(async () => {
      const latestStatus = await fetchStatus();
      if (latestStatus !== "open" && latestStatus !== "connected") fetchQr();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchQr, fetchStatus]);

  const isConnected = status === "open" || status === "connected";

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" /> QR Code — {provider.instance_name}
          <Badge variant="outline" className={`ml-auto text-[10px] ${
            isConnected ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"
          }`}>
            {isConnected ? <><Wifi className="h-3 w-3 mr-1" /> Conectado</> : <><WifiOff className="h-3 w-3 mr-1" /> {status}</>}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {loading ? (
          <div className="w-[250px] h-[250px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : isConnected ? (
          <div className="w-[250px] h-[250px] flex items-center justify-center bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <div className="text-center">
              <Wifi className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-400">WhatsApp Conectado</p>
            </div>
          </div>
        ) : qrData ? (
          <div className="bg-background p-3 rounded-xl border border-border">
            <img src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`} alt="QR Code" className="w-[250px] h-[250px] rounded-lg" />
          </div>
        ) : (
          <div className="w-[250px] h-[250px] flex items-center justify-center bg-muted rounded-xl">
            <p className="text-xs text-muted-foreground">QR Code indisponível</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {isConnected ? "Sessão ativa e pronta para enviar mensagens" : "Escaneie com seu WhatsApp para conectar"}
        </p>
        <Button size="sm" variant="outline" onClick={() => { fetchQr(); fetchStatus(); }} disabled={loading}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </CardContent>
    </Card>
  );
}
