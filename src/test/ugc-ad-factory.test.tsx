import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UgcAdFactory from "@/pages/UgcAdFactory";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), update: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/integrations/supabase/client", () => {
  const job = { id: "job-1", produto: "Produto", status: "gating", current_step: null, script_json: { hook: "Script existente" }, casting_json: null, gate_errors: [], created_at: "2026-09-01" };
  const query = {
    select: () => query, order: () => query, limit: () => query, eq: () => query,
    insert: () => query,
    update: (value: unknown) => { mocks.update(value); return query; },
    single: async () => ({ data: job, error: null }),
    then: (resolve: (value: { data: typeof job[]; error: null }) => void) => resolve({ data: [job], error: null }),
  };
  return { supabase: { from: () => query, auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) }, functions: { invoke: mocks.invoke } } };
});

async function run() {
  render(<UgcAdFactory />);
  fireEvent.change(screen.getByPlaceholderText("ex: Curso de X, suplemento Y"), { target: { value: "Produto" } });
  fireEvent.click(screen.getByRole("button", { name: /Rodar gates/ }));
}

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("UGC pipeline routing", () => {
  it("invokes script then casting exactly once with supported query URLs", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, script: { hook: "Novo" } }, error: null });
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, casting: { wardrobe: "Casual" } }, error: null });
    await run();
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("casting aprovado"));
    expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual(["ugc-pipeline?step=script", "ugc-pipeline?step=casting"]);
    expect(mocks.invoke.mock.calls[1][1].body.script).toEqual({ hook: "Script existente" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the HTTP 422 response without retrying generation or casting a stale script", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ error: "gate_failed", gate: "script", errors: ["hook inválido"] }), { status: 422 })) });
    await run();
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ gate_errors: ["hook inválido"], status: "gate_failed" }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([401, 500])("does not persist a gate failure for HTTP %s", async status => {
    mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response("{}", { status })) });
    await run();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops on network failure without marking the script rejected", async () => {
    mocks.invoke.mockRejectedValue(new TypeError("offline"));
    await run();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
