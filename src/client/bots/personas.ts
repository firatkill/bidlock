export type Persona = "cautious" | "steady" | "sniper";
export const personas = {
  cautious: {
    budget: [4, 6],
    first: 5000,
    normal: [4000, 6000],
    late: [3000, 5000],
    chance: [0.5, 0.4],
    pays: 1,
  },
  steady: {
    budget: [6, 9],
    first: 1000,
    normal: [2000, 4000],
    late: [2000, 3000],
    chance: [0.8, 0.9],
    pays: 0.9,
  },
  sniper: {
    budget: [8, 12],
    first: 0,
    normal: [1000, 1000],
    late: [2000, 3000],
    chance: [0, 0.95],
    pays: 0.6,
  },
} as const;
export const drawDelay = (
  range: readonly [number, number],
  rng: () => number,
) => Math.round(range[0] + (range[1] - range[0]) * rng());
export function drawBudget(
  persona: Persona,
  startingPrice: number,
  increment: number,
  rng: () => number,
) {
  // Draw a dimensionless increment count; monetary values remain integer cents.
  const [lo, hi] = personas[persona].budget;
  const lowSteps = (startingPrice * lo) / (2 * increment);
  const highSteps = (startingPrice * hi) / (2 * increment);
  return Math.round(lowSteps + (highSteps - lowSteps) * rng()) * increment;
}
export const pays = (persona: Persona, rng: () => number) =>
  rng() < personas[persona].pays;
