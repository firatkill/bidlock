import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BenchmarkHeadline } from "../../src/components/lobby/LobbyContent";
import { benchmark } from "../fixtures/benchmark";
afterEach(cleanup);
test("TC-269: full benchmark formats measured numbers, exact copy, date and results link", () => {
  render(<BenchmarkHeadline result={benchmark} />);
  expect(
    screen.getByText(
      "Last benchmark: 1,234 accepted bids from 500 concurrent bidders in 60 s. 1 winner. 0 invalid bids. p95 25.12 ms.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Measured 2026-11-07 on GitHub Actions in Docker Compose, not on this site.",
    ),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "See the full results" })
      .getAttribute("href"),
  ).toBe("/how-it-works#benchmark");
});
test("TC-269: empty benchmark hides the whole band", () => {
  const view = render(
    <BenchmarkHeadline result={{ schema: 1, empty: true }} />,
  );
  expect(view.container.innerHTML).toBe("");
});
