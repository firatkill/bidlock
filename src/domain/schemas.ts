import { z } from "zod";
import { ErrorCode } from "./errors";
export const Id = z.uuid();
export const Cents = z.number().int().min(1).max(100_000_000);
export const Iso = z.iso.datetime({ offset: true });
export const Status = z.enum([
  "scheduled",
  "live",
  "closed",
  "settled",
  "unsold",
]);
export const PaymentState = z
  .enum(["awaiting_payment", "offered_to_runner_up", "paid", "expired"])
  .nullable();
export const IdParams = z.object({ id: Id }).strict();

export const ErrorBody = z
  .object({
    error: z
      .object({
        code: ErrorCode, // z.enum([...all codes in §10.12])
        message: z.string(), // developer-facing English; UI uses its own copy
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    request_id: z.uuid(),
  })
  .strict();

export const Me = z
  .object({
    id: Id,
    display_name: z.string().min(2).max(24),
    payment_strikes: z.number().int().min(0),
    active_sandbox: z
      .object({
        sandbox_id: Id,
        auction_id: Id,
        expires_at: Iso,
        status: Status,
        ends_at: Iso,
      })
      .strict()
      .nullable(),
    open_offers: z.array(
      z
        .object({
          auction_id: Id,
          lot_no: z.number().int(),
          title: z.string(),
          rank: z.union([z.literal(1), z.literal(2)]),
          amount: Cents,
          deadline: Iso,
        })
        .strict(),
    ),
    server_now: Iso,
  })
  .strict();

const PublicBidder = z
  .object({ id: Id, display_name: z.string(), is_bot: z.boolean() })
  .strict();
export const AuctionState = z
  .object({
    id: Id,
    lot_no: z.number().int().positive(),
    kind: z.enum(["public", "sandbox", "test"]),
    title: z.string(),
    status: Status,
    payment_state: PaymentState,
    starting_price: Cents,
    current_price: Cents.nullable(),
    min_next_bid: Cents,
    max_bid: Cents,
    increment: Cents,
    bid_count: z.number().int().min(0),
    leader: PublicBidder.nullable(),
    starts_at: Iso,
    ends_at: Iso,
    original_ends_at: Iso,
    closed_at: Iso.nullable(),
    settled_at: Iso.nullable(),
    snipe_window_s: z.number().int(),
    extend_by_s: z.number().int(),
    max_extensions: z.number().int(),
    extension_count: z.number().int(),
    last_extension: z
      .object({
        n: z.number().int(),
        bid_id: Id,
        old_ends_at: Iso,
        new_ends_at: Iso,
        at: Iso,
      })
      .strict()
      .nullable(),
    offer: z
      .object({
        rank: z.union([z.literal(1), z.literal(2)]),
        bidder_id: Id,
        display_name: z.string(),
        is_bot: z.boolean(),
        amount: Cents,
        status: z.enum(["open", "paid"]),
        opened_at: Iso,
        deadline: Iso,
      })
      .strict()
      .nullable(),
    expired_offers: z.array(
      z
        .object({ rank: z.union([z.literal(1), z.literal(2)]), bidder_id: Id })
        .strict(),
    ),
    sandbox: z
      .object({ id: Id, owner_id: Id, expires_at: Iso })
      .strict()
      .nullable(),
    next_public_auction_id: Id.nullable(),
    version: z.number().int().positive(),
    server_now: Iso,
  })
  .strict();

export const BidsQuery = z
  .object({
    cursor: z.coerce.number().int().min(1).optional(), // bids with bid_no < cursor, newest first
    after: z.coerce.number().int().min(0).optional(), // bids with bid_no > after, oldest first
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine((q) => !(q.cursor !== undefined && q.after !== undefined), {
    message: "cursor and after are exclusive",
  });

export const BidItem = z
  .object({
    id: Id,
    bid_no: z.number().int().positive(),
    bidder_id: Id,
    display_name: z.string(),
    is_bot: z.boolean(),
    amount: Cents,
    placed_at: Iso,
    extended: z.boolean(),
  })
  .strict();
export const BidsPage = z
  .object({
    bids: z.array(BidItem),
    next_cursor: z.number().int().positive().nullable(),
  })
  .strict();

export const PlaceBidBody = z
  .object({ amount: Cents, idempotency_key: z.uuid() })
  .strict();

export const BidAccepted = z
  .object({
    bid: z
      .object({
        id: Id,
        bid_no: z.number().int().positive(),
        amount: Cents,
        placed_at: Iso,
      })
      .strict(),
    auction: z
      .object({
        id: Id,
        status: Status,
        current_price: Cents,
        leader_bidder_id: Id,
        min_next_bid: Cents,
        max_bid: Cents,
        ends_at: Iso,
        extended: z.boolean(),
        extension_count: z.number().int(),
        version: z.number().int(),
      })
      .strict(),
    replayed: z.boolean(),
    server_now: Iso,
  })
  .strict();

export const BidRejectionDetails = z
  .object({
    min_next_bid: Cents.nullable(),
    max_bid: Cents.nullable(),
    current_price: Cents.nullable(),
    leader_bidder_id: Id.nullable(),
    status: Status.nullable(),
    ends_at: Iso.nullable(),
    version: z.number().int().nullable(),
    replayed: z.boolean(),
    server_now: Iso,
  })
  .strict();

export const PayAccepted = z
  .object({
    auction_id: Id,
    status: z.literal("settled"),
    payment_state: z.literal("paid"),
    offer_rank: z.union([z.literal(1), z.literal(2)]),
    amount: Cents,
    replayed: z.boolean(),
    version: z.number().int(),
    server_now: Iso,
  })
  .strict();

export const SandboxCreated = z
  .object({
    sandbox_id: Id,
    auction_id: Id,
    expires_at: Iso,
    bot_seed: z.number().int(),
  })
  .strict();

export const BotTokens = z
  .object({
    auction_id: Id,
    bot_seed: z.number().int(),
    expires_at: Iso,
    bots: z
      .array(
        z
          .object({
            id: Id,
            persona: z.enum(["cautious", "steady", "sniper"]),
            display_name: z.string(),
            token: z.string(),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();

export type AuctionState = z.infer<typeof AuctionState>;
export type BidItem = z.infer<typeof BidItem>;
export type Me = z.infer<typeof Me>;
export const AuctionList = z
  .object({ public: AuctionState, sandbox: AuctionState.nullable() })
  .strict();
const Outcome = z.enum(["accepted", "rejected"]);
export const BidResultRow = z
  .object({
    outcome: Outcome,
    error_code: ErrorCode.nullable(),
    replayed: z.boolean(),
    auction_id: Id.nullable(),
    bid_id: Id.nullable(),
    bid_no: z.number().int().nullable(),
    amount: Cents.nullable(),
    placed_at: Iso.nullable(),
    status: Status.nullable(),
    current_price: Cents.nullable(),
    leader_bidder_id: Id.nullable(),
    min_next_bid: Cents.nullable(),
    max_bid: Cents.nullable(),
    ends_at: Iso.nullable(),
    extended: z.boolean().nullable(),
    extension_count: z.number().int().nullable(),
    version: z.number().int().nullable(),
    server_now: Iso,
  })
  .strict();
export const PayResultRow = z
  .object({
    outcome: Outcome,
    error_code: ErrorCode.nullable(),
    replayed: z.boolean(),
    auction_id: Id.nullable(),
    status: Status.nullable(),
    payment_state: PaymentState,
    offer_rank: z.union([z.literal(1), z.literal(2)]).nullable(),
    amount: Cents.nullable(),
    version: z.number().int().nullable(),
    server_now: Iso,
  })
  .strict();
export const SandboxResultRow = z
  .object({
    outcome: Outcome,
    error_code: ErrorCode.nullable(),
    sandbox_id: Id.nullable(),
    auction_id: Id.nullable(),
    expires_at: Iso.nullable(),
    bot_seed: z.number().int().nullable(),
    retry_after_ms: z.number().int().nullable(),
  })
  .strict();
export const BidderCreated = z.discriminatedUnion("outcome", [
  z
    .object({
      outcome: z.literal("accepted"),
      bidder_id: Id,
      display_name: z.string(),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("rejected"),
      error_code: z.literal("RATE_LIMITED"),
      retry_after_ms: z.number().int().nonnegative(),
    })
    .strict(),
]);
export const BidderRenamed = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("accepted") }).strict(),
  z
    .object({
      outcome: z.literal("rejected"),
      error_code: z.literal("NOT_FOUND"),
    })
    .strict(),
]);
export const SandboxBots = z
  .object({
    sandbox_id: Id,
    auction_id: Id,
    expires_at: Iso,
    bot_seed: z.number().int(),
    bots: z
      .array(
        z
          .object({
            id: Id,
            persona: z.enum(["cautious", "steady", "sniper"]),
            display_name: z.string(),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
export const Stats = z
  .object({
    bids_today: z.number().int().nonnegative(),
    active_sandboxes: z.number().int().nonnegative(),
    public_lots_today: z.number().int().nonnegative(),
    server_now: Iso,
  })
  .strict();
export const TestAuctionBody = z
  .object({
    duration_s: z.number().int().min(5).max(3600).default(120),
    starting_price: Cents.default(1000),
    snipe_window_s: z.number().int().min(0).max(300).default(10),
    extend_by_s: z.number().int().min(1).max(600).default(30),
    max_extensions: z.number().int().min(0).max(100).default(20),
    payment_window_s: z.number().int().min(10).max(3600).default(180),
    starts_in_s: z.number().int().min(0).max(3600).default(0),
    title: z.string().min(3).max(80).optional(),
  })
  .strict()
  .refine((v) => v.extend_by_s >= v.snipe_window_s, {
    message: "extend_by_s must be at least snipe_window_s",
  });
export const TestClockBody = z
  .object({ offset_ms: z.number().int().min(-86400000).max(86400000) })
  .strict();

const Count = z.number().int().nonnegative();
const Measurement = z.number().nonnegative();
export const BenchResult = z.union([
  z.object({ schema: z.literal(1), empty: z.literal(true) }).strict(),
  z
    .object({
      schema: z.literal(1),
      date: z.iso.date(),
      commit: z.string().min(1),
      runner: z
        .object({
          os: z.string(),
          cpus: Count,
          cpu_model: z.string(),
          memory_gb: Measurement,
        })
        .strict(),
      config: z
        .object({
          vus: Count,
          duration_s: Count,
          db_pool_max: Count,
          postgres: z.string(),
          auction: z
            .object({
              duration_s: Count,
              snipe_window_s: Count,
              extend_by_s: Count,
              max_extensions: Count,
            })
            .strict(),
        })
        .strict(),
      requests: z
        .object({ bids: Count, replays: Count, rps: Measurement })
        .strict(),
      outcomes: z
        .object({
          accepted: Count,
          BID_TOO_LOW: Count,
          ALREADY_LEADING: Count,
          AUCTION_CLOSED: Count,
          RATE_LIMITED: Count,
          OTHER: Count,
        })
        .strict(),
      unexpected_error_rate: Measurement,
      latency_ms: z
        .object({
          p50: Measurement,
          p90: Measurement,
          p95: Measurement,
          p99: Measurement,
          max: Measurement,
        })
        .strict(),
      auction: z
        .object({
          final_price: Cents.nullable(),
          bid_count: Count,
          extension_count: Count,
          status: Status,
        })
        .strict(),
      invariants: z.array(
        z
          .object({ id: z.string(), check: z.string(), violations: Count })
          .strict(),
      ),
      thresholds: z
        .object({
          p95_ms: Measurement,
          p99_ms: Measurement,
          unexpected_error_rate: Measurement,
          passed: z.boolean(),
        })
        .strict(),
    })
    .strict(),
]);
export type BenchResult = z.infer<typeof BenchResult>;
