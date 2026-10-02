import { describe, expect, it } from "vitest";
import {
  MAX_POST_ATTEMPTS, dispatchBlocker, geelarkPublishRequest, geelarkTaskId, geelarkTaskOutcome, planPosts, utmLink, type DispatchCandidate,
} from "@shared/content-pipeline";

const now = new Date("2026-10-02T12:00:00Z");
const ok: DispatchCandidate = {
  post: { status: "agendado", attempts: 0, scheduled_at: "2026-10-02T11:00:00Z" },
  content: { status: "aprovado", media_url: "https://x/v.mp4" },
  account: { status: "ativo", provider: "geelark", geelark_env_id: "557536075321468390" },
};

describe("content pipeline", () => {
  it("only dispatches approved pieces to active GeeLark accounts within attempts and time", () => {
    expect(dispatchBlocker(ok, now)).toBeNull();
    expect(dispatchBlocker({ ...ok, content: { ...ok.content, status: "pronto" } }, now)).toContain("só sai aprovada");
    expect(dispatchBlocker({ ...ok, account: { ...ok.account, status: "aquecendo" } }, now)).toContain("aquecendo");
    expect(dispatchBlocker({ ...ok, post: { ...ok.post, attempts: MAX_POST_ATTEMPTS } }, now)).toContain("tentativas");
    expect(dispatchBlocker({ ...ok, post: { ...ok.post, scheduled_at: "2026-10-02T13:00:00Z" } }, now)).toContain("hora");
    expect(dispatchBlocker({ ...ok, content: { ...ok.content, media_url: null } }, now)).toContain("sem vídeo");
    expect(dispatchBlocker({ ...ok, account: { ...ok.account, geelark_env_id: null } }, now)).toContain("sem aparelho");
  });

  it("tags the account link with UTM per post", () => {
    const link = new URL(utmLink("https://site.com/p?x=1", { platform: "tiktok", handle: "@jp.cortes", postId: "abcdef12-3456" }));
    expect(link.searchParams.get("x")).toBe("1");
    expect(link.searchParams.get("utm_source")).toBe("tiktok");
    expect(link.searchParams.get("utm_medium")).toBe("organic");
    expect(link.searchParams.get("utm_campaign")).toBe("jp.cortes");
    expect(link.searchParams.get("utm_content")).toBe("abcdef12");
  });

  it("builds the GeeLark publish request for each platform", () => {
    const base = { envId: "E1", videoUrl: "https://material.geelark.com/a.mp4", caption: "legenda", scheduleAt: new Date("2026-10-02T12:00:00Z") };
    const tk = geelarkPublishRequest({ ...base, platform: "tiktok" });
    expect(tk.path).toBe("/open/v1/task/add");
    expect(tk.body).toMatchObject({ taskType: 1, list: [{ envId: "E1", video: base.videoUrl, videoDesc: "legenda", scheduleAt: 1790942400, maxTryTimes: 0, needShareLink: true }] });
    const ig = geelarkPublishRequest({ ...base, platform: "instagram" });
    expect(ig).toMatchObject({ path: "/open/v1/rpa/task/instagramPubReels", body: { id: "E1", description: "legenda", video: [base.videoUrl] } });
    const fb = geelarkPublishRequest({ ...base, platform: "facebook", page: "Página X" });
    expect(fb).toMatchObject({ path: "/open/v1/rpa/task/faceBookPubReels", body: { id: "E1", video: base.videoUrl, page: "Página X" } });
    const yt = geelarkPublishRequest({ ...base, platform: "youtube", title: "Título" });
    expect(yt).toMatchObject({ path: "/open/v1/rpa/task/youtubePubShort", body: { title: "Título", sameStyleVoice: 0, originalVoice: 100 } });
    expect(String((geelarkPublishRequest({ ...base, platform: "facebook", caption: "x".repeat(900) }).body as { description: string }).description).length).toBe(500);
  });

  it("reads the task id from both response shapes", () => {
    expect(geelarkTaskId({ taskIds: ["T1"] })).toBe("T1");
    expect(geelarkTaskId({ taskId: "T2" })).toBe("T2");
    expect(geelarkTaskId({})).toBeNull();
    expect(geelarkTaskId(null)).toBeNull();
  });

  it("maps task results, stops on account problems and after 3 attempts", () => {
    expect(geelarkTaskOutcome({ status: 2 }, 1).postStatus).toBe("publicando");
    expect(geelarkTaskOutcome({ status: 3 }, 1).postStatus).toBe("publicado");
    expect(geelarkTaskOutcome({ status: 7 }, 1).postStatus).toBe("cancelado");
    expect(geelarkTaskOutcome({ status: 4, failCode: 20136, failDesc: "Account blocked" }, 1)).toMatchObject({ postStatus: "falhou", accountStatus: "bloqueado", retry: false });
    expect(geelarkTaskOutcome({ status: 4, failCode: 20116 }, 1)).toMatchObject({ postStatus: "falhou", accountStatus: "pausado", retry: false });
    expect(geelarkTaskOutcome({ status: 4, failCode: 20107, failDesc: "Unable to load video" }, 1)).toMatchObject({ postStatus: "agendado", retry: true });
    expect(geelarkTaskOutcome({ status: 4, failCode: 20107 }, MAX_POST_ATTEMPTS)).toMatchObject({ postStatus: "falhou", retry: false });
  });

  it("plans posts within each account's daily limit, spaced in the day", () => {
    const start = new Date("2026-10-03T12:00:00Z");
    const plan = planPosts(["c1", "c2", "c3"], [{ id: "a", daily_post_limit: 2, taken: [] }, { id: "b", daily_post_limit: 1, taken: ["c1"] }, { id: "off", daily_post_limit: 0, taken: [] }], start, 180);
    const at = (c: string, a: string) => plan.find((p) => p.contentId === c && p.accountId === a)?.scheduledAt.toISOString();
    expect(plan.some((p) => p.accountId === "off")).toBe(false);
    expect(at("c1", "b")).toBeUndefined();
    expect(at("c1", "a")).toBe("2026-10-03T12:00:00.000Z");
    expect(at("c2", "a")).toBe("2026-10-03T15:00:00.000Z");
    expect(at("c3", "a")).toBe("2026-10-04T12:00:00.000Z");
    expect(at("c2", "b")).toBe("2026-10-03T12:00:00.000Z");
    expect(at("c3", "b")).toBe("2026-10-04T12:00:00.000Z");
  });
});
