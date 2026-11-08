"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "UTC";

// Match SSR during hydration, then update every timestamp to the visitor's zone.
export function useTimeZone() {
  return useSyncExternalStore(subscribe, browserTimeZone, serverTimeZone);
}
