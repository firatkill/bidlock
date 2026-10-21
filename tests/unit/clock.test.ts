import { expect, test } from "vitest";
import { ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
const iso = (ms: number) => new Date(ms).toISOString();
test("TC-177: UT-03 symmetric RTT and lowest RTT sample determine offset", () => {
  const clock = new ClockSync();
  expect(clock.offsetMs()).toBe(0);
  clock.addSample(1000, 1100, iso(1250));
  expect(clock.offsetMs()).toBe(200);
  expect(clock.serverNow(2000)).toBe(2200);
  clock.addSample(2000, 2200, iso(2800));
  expect(clock.offsetMs()).toBe(200);
  clock.addSample(3000, 3020, iso(3310));
  expect(clock.offsetMs()).toBe(300);
  clock.addSample(5000, 4999, iso(0));
  clock.addSample(0, 10001, iso(0));
  expect(clock.offsetMs()).toBe(300);
});
test("TC-177: UT-03 ring retains only eight samples", () => {
  const clock = new ClockSync();
  clock.addSample(0, 0, iso(100));
  for (let i = 1; i <= 8; i++)
    clock.addSample(i * 1000, i * 1000 + 10, iso(i * 1000 + 205));
  expect(clock.offsetMs()).toBe(200);
});
test("TC-177: UT-03 countdown ceilings and clamps at zero", () => {
  for (const [input, output] of [
    [0, "0:00"],
    [999, "0:01"],
    [7000, "0:07"],
    [192000, "3:12"],
    [3723000, "1:02:03"],
    [-100, "0:00"],
  ] as const)
    expect(formatCountdown(input)).toBe(output);
  expect(remainingMs(iso(1000), 1001)).toBe(0);
  expect(remainingMs(iso(1000), 500)).toBe(500);
});
