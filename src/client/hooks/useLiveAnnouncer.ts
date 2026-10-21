"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useLiveAnnouncer() {
  const [polite, setPolite] = useState(""),
    [assertive, setAssertive] = useState("");
  const last = useRef(-Infinity),
    pending = useRef(""),
    seen = useRef(new Set<string>()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const announcePrice = useCallback((text: string) => {
    pending.current = text;
    const elapsed = performance.now() - last.current;
    if (elapsed >= 3000) {
      last.current = performance.now();
      setPolite(text);
      return;
    }
    timer.current ??= setTimeout(() => {
      last.current = performance.now();
      setPolite(pending.current);
      timer.current = null;
    }, 3000 - elapsed);
  }, []);
  const announceEvent = useCallback((id: string, text: string) => {
    if (seen.current.has(id)) return;
    seen.current.add(id);
    setAssertive(text);
  }, []);
  return { polite, assertive, announcePrice, announceEvent };
}
