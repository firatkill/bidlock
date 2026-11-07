// Display mirror of PRD FR-02, FR-07 and FR-11; SQL remains authoritative.
export const RULE_DEFAULTS = {
  maxSteps: 100,
  maxCents: 100_000_000,
  snipeWindowSeconds: 10,
  extendBySeconds: 30,
  maxExtensions: 20,
  paymentWindowSeconds: 180,
} as const;
