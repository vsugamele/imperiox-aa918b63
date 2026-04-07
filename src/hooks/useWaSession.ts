import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UiStatus = "idle" | "pending" | "awaiting_qr" | "qr_ready" | "connected" | "stale" | "error";

export interface WorkerDiagnostics {
  instructions?: string;
  hasSession?: boolean;
  needsQr?: boolean;
  qrAvailable?: boolean;
  qrAt?: string;
  commandId?: string;
  commandStatus?: string;
  sessionStatus?: string | null;
  reason?: string;
  pollCount?: number;
}

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
  const [diagnostics, setDiagnostics] = useState<WorkerDiagnostics>({});

  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const pollCountRef = useRef(0);
  const noQrCountRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

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
    setDiagnostics({});
    pollCountRef.current = 0;
    noQrCountRef.current = 0;

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
        pollCountRef.current++;

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

        // Extract QR from events
        const evtImg = payload?.qrImageUrl || payload?.qr || payload?.image || null;
        const evtTxt = payload?.qrText || null;

        const cmd = commandRes.data as any;

        // Extract QR from command result (fallback)
        const cmdQrImg = cmd?.result?.qr?.qrImageUrl || cmd?.result?.qr?.image || cmd?.result?.qrImageUrl || null;
        const cmdQrTxt = cmd?.result?.qr?.qrText || cmd?.result?.qrText || null;

        // Use whichever source has the QR
        const finalImg = evtImg || cmdQrImg || null;
        const finalTxt = evtTxt || cmdQrTxt || null;

        if (finalImg) setQrImageUrl(finalImg);
        if (finalTxt) setQrText(finalTxt);

        const hasRealQr = Boolean(finalImg || finalTxt);

        // Build diagnostics
        const diag: WorkerDiagnostics = {
          instructions: payload?.instructions || cmd?.result?.instructions || undefined,
          hasSession: payload?.hasSession ?? cmd?.result?.hasSession ?? undefined,
          needsQr: payload?.needsQr ?? cmd?.result?.needsQr ?? undefined,
          qrAvailable: payload?.qrAvailable ?? cmd?.result?.qrAvailable ?? undefined,
          qrAt: payload?.qrAt || cmd?.result?.qrAt || undefined,
          commandId: cmdId,
          commandStatus: cmd?.status,
          sessionStatus,
          reason: cmd?.error || payload?.reason || undefined,
          pollCount: pollCountRef.current,
        };
        setDiagnostics(diag);

        // Determine UI status
        const cmdError = cmd?.error || null;
        const commandDone = cmd?.status === "done" || cmd?.status === "success" || cmd?.status === "completed";
        const commandFailed = cmd?.status === "error" || Boolean(cmdError);

        let nextUi: UiStatus;

        if (commandFailed || sessionStatus === "error") {
          nextUi = "error";
          if (cmdError) setErrorMessage(cmdError);
        } else if (sessionStatus === "connected") {
          nextUi = "connected";
        } else if (hasRealQr) {
          nextUi = "qr_ready";
        } else if (commandDone && !hasRealQr) {
          // Command finished but no QR came — session likely stale
          noQrCountRef.current++;
          if (noQrCountRef.current >= 2) {
            nextUi = "stale";
          } else {
            nextUi = "awaiting_qr";
          }
        } else if (cmd?.status === "pending" || cmd?.status === "processing") {
          nextUi = "pending";
        } else {
          nextUi = "awaiting_qr";
        }

        setUiStatus(nextUi);

        const elapsed = Date.now() - (startedAtRef.current || Date.now());
        const shouldStop =
          nextUi === "connected" ||
          nextUi === "error" ||
          nextUi === "qr_ready" ||
          nextUi === "stale" ||
          elapsed > timeoutMs;

        if (shouldStop) {
          if (elapsed > timeoutMs && nextUi !== "connected" && nextUi !== "error" && nextUi !== "qr_ready") {
            setUiStatus("stale");
            setErrorMessage("Timeout ao obter QR (90s). Sessão pode estar travada.");
          }
          clearTimer();
        }
      } catch (err: any) {
        setUiStatus("error");
        setErrorMessage(err?.message || "Erro de polling");
        clearTimer();
      }
    }, pollMs);
  }, [tenantId, sessionKey, project, pollMs, timeoutMs]);

  useEffect(() => () => clearTimer(), []);

  const canGenerateQr = useMemo(
    () => uiStatus !== "pending" && uiStatus !== "awaiting_qr",
    [uiStatus]
  );

  const resetSession = useCallback(async () => {
    clearTimer();

    // 1. Insert reset command for the worker
    await supabase
      .from("wa_hub_iso_commands")
      .insert({
        tenant_id: tenantId,
        session_key: sessionKey,
        action: "reset_session",
        payload: { project } as any,
        status: "pending",
      });

    // 2. Delete old events
    await supabase
      .from("wa_hub_iso_events")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("session_key", sessionKey);

    // 3. Delete completed/error commands (keep the reset one)
    await supabase
      .from("wa_hub_iso_commands")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("session_key", sessionKey)
      .in("status", ["done", "success", "completed", "error"]);

    // 4. Update session status to reset
    await supabase
      .from("wa_hub_iso_sessions")
      .update({ status: "reset" } as any)
      .eq("tenant_id", tenantId)
      .eq("session_key", sessionKey);

    // 5. Reset local state
    setUiStatus("idle");
    setCommandId(null);
    setQrImageUrl(null);
    setQrText(null);
    setErrorMessage(null);
    setSessionRawStatus(null);
    setDiagnostics({});
    pollCountRef.current = 0;
    noQrCountRef.current = 0;
    startedAtRef.current = null;
  }, [tenantId, sessionKey, project]);

  return {
    uiStatus,
    commandId,
    qrImageUrl,
    qrText,
    errorMessage,
    sessionRawStatus,
    canGenerateQr,
    startGetQr,
    resetSession,
    diagnostics,
  };
}
