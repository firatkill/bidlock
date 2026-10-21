import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { ErrorView } from "@/components/shell/ErrorView";
import { shellCopy as copy } from "@/domain/copy";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("TC-209 TC-173: error view reports only its ID and shows confirmation after success", async () => {
  let reported = "";
  const fetcher = vi.fn((_path: unknown, init?: RequestInit) => {
    if (typeof init?.body !== "string")
      throw new Error("Expected JSON string body");
    const body = z
      .object({ error_id: z.uuid() })
      .strict()
      .parse(JSON.parse(init.body));
    reported = body.error_id;
    return Promise.resolve(Response.json({ request_id: reported }));
  });
  vi.stubGlobal("fetch", fetcher);
  const reset = vi.fn();
  render(<ErrorView reset={reset} />);
  expect(screen.getByRole("heading").textContent).toBe(copy.error);
  await waitFor(() => {
    expect(screen.getByText(copy.errorId(reported))).toBeTruthy();
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: copy.reload }));
  expect(reset).toHaveBeenCalledOnce();
});
test("TC-209: report failure never claims an error was logged", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetcher);
  const reset = vi.fn();
  render(<ErrorView reset={reset} />);
  await waitFor(() => {
    expect(fetcher).toHaveBeenCalledOnce();
  });
  expect(screen.queryByText(/The error was logged/)).toBeNull();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: copy.reload }));
  expect(reset).toHaveBeenCalledOnce();
});
