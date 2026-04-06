import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UiStatus = "idle" | "pending" | "awaiting_qr" | "connected" | "error";

export function useWaSession(params: {
  tenantId: string;
  sessionKey: string;
  project?: string;
  pollMs?: number;
  timeoutMs?: number;
}) {
  const { tenantId, sessionKey, project = "igaming", pollMs = 2500, timeoutMs = 90000 } = params;

  const [uiStatus, setUiStatus] = useState<UiStatus>("idle");
  const [commandId, setCommandId] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionRawStatus, setSessionRawStatus] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const mapStatus = useCallback((args: {
    commandStatus?: string;
    sessionStatus?: string | null;
    hasQr?: boolean;
    commandError?: string | null;
  }): UiStatus => {
    const { commandStatus, sessionStatus, hasQr, commandError } = args;
    if (commandError || commandStatus === "error" || sessionStatus === "error") return "error";
    if (sessionStatus === "connected") return "connected";
    if (hasQr || sessionStatus === "awaiting_qr") return "awaiting_qr";
    if (commandStatus === "pending" || commandStatus === "processing") return "pending";
    return "idle";
  }, []);

  // Check initial session status on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase
        .from("wa_hub_iso_sessions")
        .select("status")
        .eq("tenant_id", tenantId)
        .eq("session_key", sessionKey)
        .maybeSingle();
      if (data?.status) {
        setSessionRawStatus(data.status);
        if (data.status === "connected") setUiStatus("connected");
      }
    };
    checkSession();
  }, [tenantId, sessionKey]);

  const startGetQr = useCallback(async () => {
    setErrorMessage(null);
    setQrImageUrl(null);
    setQrText(null);
    setUiStatus("pending");

    const { data, error } = await supabase
      .from("wa_hub_iso_commands")
      .insert({
        tenant_id: tenantId,
        session_key: sessionKey,
        action: "get_qr",
        payload: { project } as any,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      setUiStatus("error");
      setErrorMessage(error?.message || "Falha ao criar comando get_qr");
      return;
    }

    const cmdId = data.id;
    setCommandId(cmdId);
    startedAtRef.current = Date.now();

    clearTimer();
    timerRef.current = setInterval(async () => {
      try {
        // Fetch all 3 in parallel
        const [sessionRes, eventsRes, commandRes] = await Promise.all([
          supabase
            .from("wa_hub_iso_sessions")
            .select("status")
            .eq("tenant_id", tenantId)
            .eq("session_key", sessionKey)
            .maybeSingle(),
          supabase
            .from("wa_hub_iso_events")
            .select("event_type, payload")
            .eq("tenant_id", tenantId)
            .eq("session_key", sessionKey)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("wa_hub_iso_commands")
            .select("status, error, result")
            .eq("id", cmdId)
            .single(),
        ]);

        const sessionStatus = sessionRes.data?.status || null;
        setSessionRawStatus(sessionStatus);

        const events = eventsRes.data || [];
        const latestQrEvent = events.find(
          (e: any) => e.event_type === "qr_status"
        );
        const payload = latestQrEvent?.payload as any;
        const hasQr = Boolean(payload?.qrAvailable || payload?.hasQr || payload?.needsQr);
        const img = payload?.qrImageUrl || payload?.qr || payload?.image || null;
        const txt = payload?.qrText || null;

        if (img) setQrImageUrl(img);
        if (txt) setQrText(txt);

        const cmd = commandRes.data as any;
        const nextUi = mapStatus({
          commandStatus: cmd?.status,
          sessionStatus,
          hasQr,
          commandError: cmd?.error || null,
        });

        setUiStatus(nextUi);
        if (cmd?.error) setErrorMessage(cmd.error);

        const elapsed = Date.now() - (startedAtRef.current || Date.now());
        const shouldStop =
          nextUi === "connected" ||
          nextUi === "error" ||
          elapsed > timeoutMs;

        if (shouldStop) {
          if (elapsed > timeoutMs && nextUi !== "connected" && nextUi !== "error") {
            setUiStatus("error");
            setErrorMessage("Timeout ao obter QR (90s)");
          }
          clearTimer();
        }
      } catch (err: any) {
        setUiStatus("error");
        setErrorMessage(err?.message || "Erro de polling");
        clearTimer();
      }
    }, pollMs);
  }, [tenantId, sessionKey, project, pollMs, timeoutMs, mapStatus]);

  useEffect(() => () => clearTimer(), []);

  const canGenerateQr = useMemo(() => uiStatus !== "pending" && uiStatus !== "awaiting_qr", [uiStatus]);

  return {
    uiStatus,
    commandId,
    qrImageUrl,
    qrText,
    errorMessage,
    sessionRawStatus,
    canGenerateQr,
    startGetQr,
  };
}
