import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JourneyData } from "@/lib/cinna-shield-x1/journey-data";
const api = vi.hoisted(() => ({ load: vi.fn(), messages: vi.fn() }));
vi.mock("@/lib/cinna-shield-x1/journey-data", () => ({ loadCinnaJourney: api.load, loadJourneyMessages: api.messages, MESSAGE_PAGE_SIZE: 50 }));
import { CinnaJourneyPanel } from "@/components/openflow/CinnaJourneyPanel";
const data: JourneyData = { conversations: [{ id: "exec", leadId: null, sessionId: "session", version: "v1", createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:01:00Z", status: "waiting", stageTitle: "Acolhimento", stages: [{ id: "welcome", title: "Acolhimento", index: 0, start: 0, wait: 3, reached: true, responded: true, advanced: false, waiting: true, human: false, stopped: false, checkout: false, holds: 1, enteredAt: "2026-09-08T10:00:00Z" }], turns: [{ id: "msg", at: "2026-09-08T10:01:00Z", stageId: "welcome", action: "hold", intent: "question" }] }], identities: { session: { name: "Lead do teste", channel: "webchat" } }, total: 1, loaded: 1, unrecognized: 0, until: "2026-09-08T10:02:00Z" };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(data); api.messages.mockResolvedValue({ messages: [{ id: "msg", direction: "in", texto: "Uma dúvida", media_url: null, meta: {}, created_at: "2026-09-08T10:01:00Z" }, { id: "out", direction: "out", texto: "Transcrição do áudio", media_url: "https://example.org/audio.mp3", meta: {}, created_at: "2026-09-08T10:01:02Z" }], total: 51 }); });
describe("Cinna journey panel", () => {
  it("opens a lead's persisted conversation with stage, audio controls and older pages", async () => {
    render(<CinnaJourneyPanel open onOpenChange={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Lead do teste/ }));
    expect(await screen.findByText("Uma dúvida")).toBeInTheDocument();
    expect(screen.getByText("Transcrição do áudio")).toBeInTheDocument();
    expect(document.querySelector("audio")?.controls).toBe(true);
    expect(document.querySelector("audio")?.autoplay).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Mensagens anteriores" }));
    await waitFor(() => expect(api.messages).toHaveBeenLastCalledWith("session", 50, expect.any(String), expect.any(AbortSignal)));
  });
  it("shows an explicit partial-coverage warning and does not label links as sales", async () => {
    api.load.mockResolvedValue({ ...data, total: 5001, loaded: 5000 });
    render(<CinnaJourneyPanel open onOpenChange={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("5000 de 5001");
    expect(screen.getByText(/Link enviado não significa compra/)).toBeInTheDocument();
  });
  it("shows read failures instead of an empty successful dashboard", async () => {
    api.load.mockRejectedValue(new Error("network"));
    render(<CinnaJourneyPanel open onOpenChange={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.queryByText("Nenhuma conversa registrada neste período.")).not.toBeInTheDocument();
  });
});
