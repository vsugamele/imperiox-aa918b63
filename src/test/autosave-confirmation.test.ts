import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoSave } from "@/components/openflow/flow-editor/useAutoSave";

describe("confirmed editor saves", () => {
  it("does not confirm closing when newer edits arrive during the write", async () => {
    let release: (() => void) | undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const hook = renderHook(({ value }) => useAutoSave({ value, onSave: save, debounce: 60000 }), { initialProps: { value: "initial" } });
    hook.rerender({ value: "first" });
    let pending: Promise<boolean>;
    await act(async () => { pending = hook.result.current.forceSave(); });
    hook.rerender({ value: "newer unsaved" });
    await act(async () => { release?.(); expect(await pending).toBe(false); });
    expect(hook.result.current.status).toBe("dirty");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
  it("returns failure, retains unsaved state and allows retry", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const hook = renderHook(({ value }) => useAutoSave({ value, onSave: save, debounce: 60000 }), { initialProps: { value: "initial" } });
    hook.rerender({ value: "edited" });
    await act(async () => { expect(await hook.result.current.forceSave()).toBe(false); });
    expect(hook.result.current.status).toBe("error");
    expect(hook.result.current.error).toBe("offline");
    await act(async () => { expect(await hook.result.current.forceSave()).toBe(true); });
    expect(hook.result.current.status).toBe("idle");
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("waits for queued edits before confirming a forced save", async () => {
    let release: (() => void) | undefined;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
    const hook = renderHook(({ value }) => useAutoSave({ value, onSave: save, debounce: 60000 }), { initialProps: { value: "initial" } });
    hook.rerender({ value: "first" });
    let first: Promise<boolean>;
    await act(async () => { first = hook.result.current.forceSave(); });
    hook.rerender({ value: "latest" });
    let complete = false;
    const latest = hook.result.current.forceSave().then(value => { complete = true; return value; });
    expect(complete).toBe(false);
    await act(async () => { release?.(); await first; expect(await latest).toBe(true); });
    expect(save.mock.calls.map(call => call[0])).toEqual(["first", "latest"]);
  });
});
