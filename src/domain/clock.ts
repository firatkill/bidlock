export interface ClockSample {
  offsetMs: number;
  rttMs: number;
  at: number;
}
export class ClockSync {
  private samples: ClockSample[] = [];
  addSample(t0: number, t1: number, serverNowIso: string): void {
    const rtt = t1 - t0;
    if (rtt < 0 || rtt > 10_000) return;
    this.samples.push({
      offsetMs: Date.parse(serverNowIso) - (t0 + t1) / 2,
      rttMs: rtt,
      at: t1,
    });
    if (this.samples.length > 8) this.samples.shift();
  }
  offsetMs(): number {
    const first = this.samples[0];
    return first
      ? this.samples.reduce(
          (best, sample) => (sample.rttMs < best.rttMs ? sample : best),
          first,
        ).offsetMs
      : 0;
  }
  serverNow(localNow: number): number {
    return localNow + this.offsetMs();
  }
}
export function remainingMs(endsAtIso: string, serverNow: number): number {
  return Math.max(0, Date.parse(endsAtIso) - serverNow);
}
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor(seconds / 60) % 60,
    rest = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${String(minutes)}:${rest}`;
}
