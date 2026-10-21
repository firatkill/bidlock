"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Me } from "@/domain/schemas";
import { getMe, renameMe } from "@/client/api";
let current: Me | null = null;
let inflight: Promise<Me> | null = null;
const listeners = new Set<() => void>();
function publish(me: Me) {
  current = me;
  listeners.forEach((listener) => {
    listener();
  });
  return me;
}
export function refreshMe(): Promise<Me> {
  inflight ??= getMe()
    .then(publish)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
export async function updateName(name: string): Promise<Me> {
  return publish(await renameMe(name));
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useMe() {
  const me = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  useEffect(() => {
    if (!current) void refreshMe().catch(() => {});
  }, []);
  return me;
}
