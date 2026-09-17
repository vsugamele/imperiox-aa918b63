import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QrCodePanel from "@/components/whatsapp/QrCodePanel";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("WhatsApp QR polling", () => {
  it("stops requesting QR codes once the latest status is connected", async () => {
    vi.useFakeTimers();
    invoke.mockImplementation(async (endpoint: string) => ({
      data: endpoint.includes("session_status") ? { status: "connected" } : { qrcode: { base64: "qr" } },
      error: null,
    }));
    await act(async () => { render(<QrCodePanel provider={{ id: "provider-1", instance_name: "Test" }} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(16000); });
    expect(invoke.mock.calls.filter(([endpoint]) => endpoint.includes("qr_code"))).toHaveLength(1);
    expect(invoke.mock.calls.filter(([endpoint]) => endpoint.includes("session_status"))).toHaveLength(3);
    cleanup();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(invoke).toHaveBeenCalledTimes(4);
  });
});
