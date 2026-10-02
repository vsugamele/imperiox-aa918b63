import { describe, expect, it, vi } from "vitest";
import { GeelarkError, geelarkClient } from "@shared/geelark";

const ok = (data: unknown) => new Response(JSON.stringify({ traceId: "T", code: 0, msg: "success", data }), { status: 200 });

describe("geelark client", () => {
  it("sends token and traceId, and returns data", async () => {
    const fetchImpl = vi.fn(async () => ok({ taskId: "558017255909123564" }));
    const data = await geelarkClient("TOKEN", fetchImpl).call("/open/v1/rpa/task/instagramPubReels", { id: "E1" });
    expect(data).toEqual({ taskId: "558017255909123564" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openapi.geelark.com/open/v1/rpa/task/instagramPubReels");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN");
    expect(headers.traceId).toMatch(/^[0-9A-F-]{36}$/);
    expect(JSON.parse(String(init.body))).toEqual({ id: "E1" });
  });

  it("throws the GeeLark error code when code is not 0", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ code: 41000, msg: "Insufficient task credits" }), { status: 200 }));
    await expect(geelarkClient("T", fetchImpl).call("/open/v1/task/add", {})).rejects.toMatchObject({ code: 41000 });
    await expect(geelarkClient("T", fetchImpl).call("/open/v1/task/add", {})).rejects.toBeInstanceOf(GeelarkError);
  });

  it("uploads a public file: gets the signed URL, downloads the source and PUTs it", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method });
      if (url.endsWith("/open/v1/upload/getUrl")) return ok({ uploadUrl: "https://oss/put?sig=1", resourceUrl: "https://material.geelark.com/v.mp4" });
      if (url === "https://storage/v.mp4") return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      return new Response("", { status: 200 });
    });
    const resource = await geelarkClient("T", fetchImpl).uploadFromUrl("https://storage/v.mp4", "mp4");
    expect(resource).toBe("https://material.geelark.com/v.mp4");
    expect(calls.map((c) => `${c.method || "GET"} ${c.url}`)).toEqual([
      "POST https://openapi.geelark.com/open/v1/upload/getUrl", "GET https://storage/v.mp4", "PUT https://oss/put?sig=1",
    ]);
  });

  it("queries up to 100 task ids", async () => {
    const fetchImpl = vi.fn(async () => ok({ total: 1, items: [{ id: "1", status: 3, shareLink: "https://tiktok/x" }] }));
    const items = await geelarkClient("T", fetchImpl).queryTasks(Array.from({ length: 150 }, (_, i) => String(i)));
    expect(items[0].shareLink).toBe("https://tiktok/x");
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)).ids).toHaveLength(100);
    expect(await geelarkClient("T", fetchImpl).queryTasks([])).toEqual([]);
  });
});
