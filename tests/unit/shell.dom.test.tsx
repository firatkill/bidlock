import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Shell } from "@/components/shell/Shell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import NotFound from "@/app/not-found";
import { shellCopy as copy } from "@/domain/copy";
import { Me } from "@/domain/schemas";
import { useMe, updateName } from "@/client/hooks/useMe";
vi.mock("@/client/hooks/useMe", () => ({
  useMe: vi.fn(),
  updateName: vi.fn(),
}));
const me = Me.parse({
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Bidder 1234",
  payment_strikes: 0,
  active_sandbox: null,
  open_offers: [],
  server_now: "2026-01-01T00:00:00Z",
});
beforeEach(() => {
  vi.mocked(useMe).mockReturnValue(me);
  vi.mocked(updateName).mockResolvedValue(me);
  document.documentElement.dataset.theme = "system";
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
test("TC-170: shell shows specified navigation, profile and strike plurals", () => {
  vi.mocked(useMe).mockReturnValue(null);
  const { rerender } = render(
    <Shell mode="on">
      <main />
    </Shell>,
  );
  expect(screen.getByText(copy.loadingProfile)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: copy.wordmark }).getAttribute("href"),
  ).toBe("/");
  expect(
    screen.getByRole("link", { name: copy.how }).getAttribute("href"),
  ).toBe("/how-it-works");
  expect(screen.getByText(copy.footer)).toBeTruthy();
  for (const strikes of [0, 1, 2]) {
    vi.mocked(useMe).mockReturnValue({ ...me, payment_strikes: strikes });
    rerender(
      <Shell mode="on">
        <main />
      </Shell>,
    );
    expect(screen.getByText(copy.profile(me.display_name))).toBeTruthy();
    if (strikes) expect(screen.getByText(copy.strikes(strikes))).toBeTruthy();
    else expect(screen.queryByText(/missed payment/)).toBeNull();
  }
});
test("TC-171: name dialog validates exact errors and saves with pending/success states", async () => {
  const user = userEvent.setup();
  render(
    <Shell mode="on">
      <main />
    </Shell>,
  );
  await user.click(screen.getByRole("button", { name: copy.edit }));
  expect(screen.getByRole("dialog", { name: copy.name.title })).toBeTruthy();
  expect(screen.getByText(copy.name.help)).toBeTruthy();
  const field = screen.getByRole("textbox", { name: copy.name.label });
  for (const [value, error] of [
    ["x", copy.name.length],
    ["hello!", copy.name.characters],
    ["sh1t", copy.name.profanity],
    ["Robot", copy.name.bot_suffix],
  ]) {
    await user.clear(field);
    await user.type(field, value ?? "");
    await user.click(screen.getByRole("button", { name: copy.name.save }));
    expect(screen.getByRole("alert").textContent).toBe(error);
  }
  expect(updateName).not.toHaveBeenCalled();
  let finish: (value: Me) => void = () => {
    throw new Error("Missing pending request");
  };
  vi.mocked(updateName).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await user.clear(field);
  await user.type(field, "  Nice   Bidder  ");
  await user.click(screen.getByRole("button", { name: copy.name.save }));
  expect(
    screen
      .getByRole("button", { name: copy.name.saving })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(updateName).toHaveBeenCalledWith("Nice Bidder");
  finish({ ...me, display_name: "Nice Bidder" });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(screen.getByRole("status").textContent).toBe(copy.name.success);
});
test("TC-171: failed save keeps dialog and exact error, Cancel returns focus", async () => {
  vi.mocked(updateName).mockRejectedValueOnce(new Error("Network failure"));
  const user = userEvent.setup();
  render(
    <Shell mode="on">
      <main />
    </Shell>,
  );
  const edit = screen.getByRole("button", { name: copy.edit });
  await user.click(edit);
  await user.click(screen.getByRole("button", { name: copy.name.save }));
  expect(screen.getByRole("alert").textContent).toBe(copy.name.failure);
  await user.click(screen.getByRole("button", { name: copy.name.cancel }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(edit);
});
test("TC-172: theme cycles system to light to dark and persists", async () => {
  const user = userEvent.setup();
  render(<ThemeToggle />);
  for (const [before, after] of [
    ["System", "light"],
    ["Light", "dark"],
    ["Dark", "system"],
  ] as const) {
    await user.click(screen.getByRole("button", { name: copy.theme(before) }));
    expect(document.documentElement.dataset.theme).toBe(after);
    expect(localStorage.getItem("bl_theme")).toBe(after);
  }
});
test("TC-173: readonly banner and not-found copy are exact", () => {
  render(
    <Shell mode="readonly">
      <NotFound />
    </Shell>,
  );
  expect(screen.getByText(copy.readonly)).toBeTruthy();
  expect(screen.getByRole("heading", { name: copy.notFound })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: copy.lobby }).getAttribute("href"),
  ).toBe("/");
});
