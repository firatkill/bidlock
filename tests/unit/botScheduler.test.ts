import { expect, test } from "vitest";
import { mulberry32 } from "@/client/bots/prng";
import { drawBudget, pays, type Persona } from "@/client/bots/personas";
import {
  createMemory,
  decide,
  preparePayment,
  thinkInterval,
} from "@/client/bots/scheduler";
import { auction } from "../fixtures/auction";
const start = Date.parse(auction.starts_at);
const room = {
  ...auction,
  starting_price: 2000,
  min_next_bid: 2000,
  ends_at: new Date(start + 120000).toISOString(),
};
const id = crypto.randomUUID();
const personas: Persona[] = ["cautious", "steady", "sniper"];
const memory = (persona: Persona) => ({
  ...createMemory(id, persona, room, () => 0.5),
  budget: 20000,
});
test("TC-218 UT-07: seeded decisions repeat and budgets are integer increment multiples", () => {
  function sequence(seed: number) {
    const rng = mulberry32(seed),
      mem = createMemory(id, "steady", room, rng);
    return Array.from({ length: 100 }, (_, i) =>
      decide(mem, room, start + i * 1000, rng),
    );
  }
  expect(sequence(42)).toEqual(sequence(42));
  expect(sequence(42)).not.toEqual(sequence(43));
  const limits = {
    cautious: [4000, 6000],
    steady: [6000, 9000],
    sniper: [8000, 12000],
  } as const;
  for (const persona of personas) {
    const rng = mulberry32(42);
    for (let n = 0; n < 1000; n++) {
      const budget = drawBudget(persona, 2000, 100, rng);
      expect(Number.isSafeInteger(budget)).toBe(true);
      expect(budget % 100).toBe(0);
      expect(budget).toBeGreaterThanOrEqual(limits[persona][0]);
      expect(budget).toBeLessThanOrEqual(limits[persona][1]);
    }
  }
});
test("TC-219 UT-07: first delays, leader guard, minimum spacing and bounded waits", () => {
  for (const persona of personas) {
    const mem = memory(persona);
    for (const at of [start + 10000, start + 110000]) {
      expect(
        decide(
          mem,
          { ...room, leader: { id, display_name: "Bot", is_bot: true } },
          at,
          () => 0,
        ).type,
      ).toBe("wait");
      expect(
        decide({ ...mem, lastBidAt: at - 1999 }, room, at, () => 0).type,
      ).toBe("wait");
      const wait = thinkInterval(persona, room, at, () => 0.99);
      expect(wait).toBeGreaterThanOrEqual(1000);
      expect(wait).toBeLessThanOrEqual(6000);
    }
  }
  expect(decide(memory("cautious"), room, start + 4999, () => 0).type).toBe(
    "wait",
  );
  expect(decide(memory("cautious"), room, start + 5000, () => 0).type).toBe(
    "bid",
  );
  expect(decide(memory("steady"), room, start + 999, () => 0).type).toBe(
    "wait",
  );
  expect(
    decide(
      { ...memory("steady"), lastBidAt: start },
      room,
      start + 2000,
      () => 0,
    ).type,
  ).toBe("bid");
});
test("TC-220 UT-07: persona amounts, sniper opening/late phase, extension and budget dropout", () => {
  expect(decide(memory("cautious"), room, start + 10000, () => 0)).toEqual({
    type: "bid",
    amount: 2000,
  });
  expect(decide(memory("steady"), room, start + 10000, () => 0)).toEqual({
    type: "bid",
    amount: 2100,
  });
  expect(decide(memory("steady"), room, start + 10000, () => 0.3)).toEqual({
    type: "bid",
    amount: 2000,
  });
  const sniper = memory("sniper");
  for (let ms = 1000; ms < 105000; ms += 1000)
    expect(decide(sniper, room, start + ms, () => 0).type).toBe("wait");
  expect(decide(sniper, room, start + 105000, () => 0.9)).toEqual({
    type: "bid",
    amount: 2200,
  });
  expect(
    decide(
      sniper,
      { ...room, ends_at: new Date(start + 150000).toISOString() },
      start + 105000,
      () => 0,
    ).type,
  ).toBe("wait");
  const opening = createMemory(id, "sniper", room, () => 0);
  expect(opening.openingBidAt).toBe(start + 3000);
  expect(decide(opening, room, start + 2999, () => 0).type).toBe("wait");
  expect(decide(opening, room, start + 3000, () => 0).type).toBe("bid");
  expect(
    decide({ ...opening, openingBidDone: true }, room, start + 6000, () => 0)
      .type,
  ).toBe("wait");
  expect(
    decide({ ...sniper, budget: 1999 }, room, start + 110000, () => 0),
  ).toEqual({ type: "drop" });
  expect(
    decide({ ...sniper, budget: 2000 }, room, start + 110000, () => 0.9),
  ).toEqual({ type: "bid", amount: 2000 });
  expect(
    decide(sniper, { ...room, status: "settled" }, start, () => 0),
  ).toEqual({ type: "stop" });
});
test("TC-221 UT-07: 10000 payment draws per persona and one delayed draw per own offer", () => {
  for (const [persona, expected] of [
    ["cautious", 1],
    ["steady", 0.9],
    ["sniper", 0.6],
  ] as const) {
    const rng = mulberry32(42);
    const count = Array.from({ length: 10000 }, () =>
      pays(persona, rng),
    ).filter(Boolean).length;
    expect(Math.abs(count / 10000 - expected)).toBeLessThanOrEqual(0.02);
  }
  const closed = {
    ...room,
    status: "closed" as const,
    offer: {
      rank: 1 as const,
      bidder_id: id,
      display_name: "Bot",
      is_bot: true,
      amount: 2000,
      status: "open" as const,
      opened_at: new Date(start + 120000).toISOString(),
      deadline: new Date(start + 300000).toISOString(),
    },
  };
  const prepared = preparePayment(
    memory("cautious"),
    closed,
    start + 120000,
    () => 0.99,
  );
  expect(prepared.payAt).toBe(start + 127950);
  expect(
    preparePayment(prepared, closed, start + 120001, () => {
      throw new Error("Redrew payment");
    }),
  ).toBe(prepared);
  expect(decide(prepared, closed, start + 120000, () => 0)).toEqual({
    type: "wait",
    ms: 6000,
  });
  expect(decide(prepared, closed, start + 127949, () => 0).type).toBe("wait");
  expect(decide(prepared, closed, start + 127950, () => 0)).toEqual({
    type: "pay",
  });
  expect(
    decide(
      prepared,
      { ...closed, offer: { ...closed.offer, bidder_id: crypto.randomUUID() } },
      start + 128000,
      () => 0,
    ).type,
  ).toBe("wait");
});
test("TC-220 UT-07: exact bid probability thresholds and think intervals match the persona table", () => {
  const table = [
    ["cautious", 0.5, 0.4, [4000, 6000], [3000, 5000]],
    ["steady", 0.8, 0.9, [2000, 4000], [2000, 3000]],
    ["sniper", 0, 0.95, [1000, 1000], [2000, 3000]],
  ] as const;
  for (const [persona, normal, late, normalWait, lateWait] of table) {
    for (const [at, chance, range] of [
      [start + 10000, normal, normalWait],
      [start + 110000, late, lateWait],
    ] as const) {
      expect(decide(memory(persona), room, at, () => chance).type).toBe("wait");
      if (chance > 0)
        expect(
          decide(memory(persona), room, at, () => chance - 0.001).type,
        ).toBe("bid");
      expect(thinkInterval(persona, room, at, () => 0)).toBe(range[0]);
      expect(thinkInterval(persona, room, at, () => 1)).toBe(range[1]);
    }
  }
});
