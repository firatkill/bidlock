"use client";
import { useState } from "react";
import { ClockSync } from "@/domain/clock";
export function useServerClock() {
  const [clock] = useState(() => new ClockSync());
  return clock;
}
