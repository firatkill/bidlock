import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";
import { bidErrorCopy, formatLedgerTime } from "@/domain/bid-feedback";
import { bidCountCopy } from "@/domain/copy";
const details = {
  min_next_bid: 1100,
  max_bid: 11000,
  current_price: 1000,
  leader_bidder_id: null,
  status: "live",
  ends_at: null,
  version: 1,
  replayed: false,
  server_now: "2026-01-01T00:00:00Z",
};
test("TC-242 rejection explanations use response fields only", () => {
  expect(bidErrorCopy({ code: "BID_TOO_LOW", message: "", details })).toBe(
    "The price check rejected your bid. The minimum is now $11.00.",
  );
  expect(
    bidErrorCopy({ code: "BID_TOO_HIGH", message: "", details }),
  ).toContain("$110.00");
  expect(
    bidErrorCopy({
      code: "RATE_LIMITED",
      message: "",
      details: { retry_after_ms: 1501 },
    }),
  ).toBe("Slow down. You can bid again in 2 s.");
  expect(bidErrorCopy({ code: "RATE_LIMITED", message: "" })).toBe(
    "Couldn't reach the server. Your bid was not confirmed.",
  );
  expect(bidErrorCopy({ code: "AUCTION_CLOSED", message: "" })).toBe(
    "This auction has closed.",
  );
  expect(bidErrorCopy({ code: "INTERNAL", message: "" })).toBe(
    "Couldn't reach the server. Your bid was not confirmed.",
  );
});
test("TC-243 ledger milliseconds are padded, TC-245 bid pluralization", () => {
  const date = new Date(2026, 0, 1, 9, 4, 2, 7);
  expect(formatLedgerTime(date.toISOString())).toBe("09:04:02.007");
  expect(bidCountCopy(0)).toBe("0 bids");
  expect(bidCountCopy(1)).toBe("1 bid");
  expect(bidCountCopy(2)).toBe("2 bids");
});

test("TC-297: explicit zones format identically under UTC and Istanbul host TZ", () => {
  const script = `
    import { formatLedgerTime } from './src/domain/bid-feedback.ts';
    console.log(JSON.stringify([
      formatLedgerTime('2026-11-08T12:58:05.975Z', 'UTC'),
      formatLedgerTime('2026-11-08T12:58:05.975Z', 'Europe/Istanbul'),
      formatLedgerTime('2026-11-08T21:04:02.007Z', 'Europe/Istanbul'),
      formatLedgerTime('2026-11-08T00:00:00.000Z', 'UTC'),
    ]));
  `;
  const outputs = ["UTC", "Europe/Istanbul"].map((TZ) =>
    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: { ...process.env, TZ },
        encoding: "utf8",
      },
    ).trim(),
  );
  expect(outputs[0]).toBe(outputs[1]);
  expect(JSON.parse(outputs[0] ?? "null")).toEqual([
    "12:58:05.975",
    "15:58:05.975",
    "00:04:02.007",
    "00:00:00.000",
  ]);
});
