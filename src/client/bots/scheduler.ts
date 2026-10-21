import type { AuctionState } from "@/domain/schemas";
import { remainingMs } from "@/domain/clock";
import {
  drawBudget,
  drawDelay,
  pays,
  personas,
  type Persona,
} from "./personas";
export type BotDecision =
  | { type: "wait"; ms: number }
  | { type: "bid"; amount: number }
  | { type: "pay" }
  | { type: "drop" }
  | { type: "stop" };
export interface BotMemory {
  id: string;
  persona: Persona;
  budget: number;
  lastBidAt: number | null;
  status: "watching" | "bidding" | "out" | "paused" | "done";
  payDecision: boolean | null;
  openingBidDone: boolean;
  openingBidAt: number | null;
  offerKey: string | null;
  payAt: number | null;
}
export const clampWait = (ms: number) => Math.max(1000, Math.min(6000, ms));
const wait = (ms: number): BotDecision => ({ type: "wait", ms: clampWait(ms) });
export function createMemory(
  id: string,
  persona: Persona,
  room: AuctionState,
  rng: () => number,
): BotMemory {
  const budget = drawBudget(persona, room.starting_price, room.increment, rng);
  const openingBidAt =
    persona === "sniper" && rng() < 0.3
      ? Date.parse(room.starts_at) + drawDelay([3000, 8000], rng)
      : null;
  return {
    id,
    persona,
    budget,
    lastBidAt: null,
    status: "watching",
    payDecision: null,
    openingBidDone: false,
    openingBidAt,
    offerKey: null,
    payAt: null,
  };
}
/** Store a payment draw once for each distinct open offer, without mutating inputs. */
export function preparePayment(
  mem: BotMemory,
  room: AuctionState,
  now: number,
  rng: () => number,
): BotMemory {
  const offer = room.offer;
  if (
    room.status !== "closed" ||
    offer?.status !== "open" ||
    offer.bidder_id !== mem.id
  )
    return mem;
  const key = `${String(offer.rank)}:${offer.opened_at}`;
  if (key === mem.offerKey) return mem;
  const payDecision = pays(mem.persona, rng);
  return {
    ...mem,
    offerKey: key,
    payDecision,
    payAt: payDecision ? now + drawDelay([3000, 8000], rng) : null,
  };
}
export function thinkInterval(
  persona: Persona,
  room: AuctionState,
  now: number,
  rng: () => number,
) {
  const config = personas[persona];
  return clampWait(
    drawDelay(
      remainingMs(room.ends_at, now) <= 15000 ? config.late : config.normal,
      rng,
    ),
  );
}
export function decide(
  mem: BotMemory,
  room: AuctionState,
  now: number,
  rng: () => number,
): BotDecision {
  if (
    room.status === "settled" ||
    room.status === "unsold" ||
    mem.status === "done"
  )
    return { type: "stop" };
  if (room.status === "closed") {
    if (
      room.offer?.status === "open" &&
      room.offer.bidder_id === mem.id &&
      Date.parse(room.offer.deadline) > now &&
      mem.payDecision &&
      mem.payAt !== null
    ) {
      return now >= mem.payAt ? { type: "pay" } : wait(mem.payAt - now);
    }
    return wait(1000);
  }
  if (room.status !== "live" || remainingMs(room.ends_at, now) === 0)
    return wait(1000);
  if (mem.status === "paused") return wait(1000);
  if (mem.status === "out") return wait(6000);
  if (room.leader?.id === mem.id)
    return wait(thinkInterval(mem.persona, room, now, rng));
  if (room.min_next_bid > mem.budget) return { type: "drop" };
  if (mem.lastBidAt !== null && now - mem.lastBidAt < 2000)
    return wait(2000 - (now - mem.lastBidAt));
  const config = personas[mem.persona];
  const age = now - Date.parse(room.starts_at);
  if (age < config.first) return wait(config.first - age);
  const late = remainingMs(room.ends_at, now) <= 15000;
  const opening =
    mem.persona === "sniper" &&
    !late &&
    !mem.openingBidDone &&
    mem.openingBidAt !== null &&
    now >= mem.openingBidAt &&
    age <= 8000;
  if (!opening && rng() >= config.chance[late ? 1 : 0])
    return wait(thinkInterval(mem.persona, room, now, rng));
  const steps =
    mem.persona === "steady"
      ? rng() < 0.25
        ? 1
        : 0
      : mem.persona === "sniper"
        ? Math.floor(rng() * 3)
        : 0;
  // Never exceed budget; the server still decides whether the bid is valid.
  const affordableSteps = Math.floor(
    (mem.budget - room.min_next_bid) / room.increment,
  );
  return {
    type: "bid",
    amount:
      room.min_next_bid + Math.min(steps, affordableSteps) * room.increment,
  };
}
