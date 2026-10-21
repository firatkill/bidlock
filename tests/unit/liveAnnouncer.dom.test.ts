import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useLiveAnnouncer } from "@/client/hooks/useLiveAnnouncer";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
test("TC-180: UT-11 latest polite price is announced at most once per three seconds", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const { result } = renderHook(() => useLiveAnnouncer());
  act(() => {
    result.current.announcePrice("Price 10");
  });
  expect(result.current.polite).toBe("Price 10");
  act(() => {
    vi.advanceTimersByTime(1000);
    result.current.announcePrice("Price 11");
    result.current.announcePrice("Price 12");
  });
  expect(result.current.polite).toBe("Price 10");
  act(() => {
    vi.advanceTimersByTime(1999);
  });
  expect(result.current.polite).toBe("Price 10");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current.polite).toBe("Price 12");
});
test("TC-180: UT-11 assertive event ids are announced once and cleanup cancels timers", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const { result, unmount } = renderHook(() => useLiveAnnouncer());
  act(() => {
    result.current.announceEvent("one", "Outbid");
  });
  expect(result.current.assertive).toBe("Outbid");
  act(() => {
    result.current.announceEvent("one", "Duplicate");
  });
  expect(result.current.assertive).toBe("Outbid");
  act(() => {
    result.current.announceEvent("two", "Won");
    result.current.announcePrice("1");
    result.current.announcePrice("2");
  });
  expect(result.current.assertive).toBe("Won");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
