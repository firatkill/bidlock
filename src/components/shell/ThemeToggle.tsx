"use client";
import { useSyncExternalStore } from "react";
import { shellCopy as copy } from "@/domain/copy";
type Theme = "system" | "light" | "dark";
const labels = copy.themeLabels;
const next = { system: "light", light: "dark", dark: "system" } as const;
function read(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}
function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    observer.disconnect();
  };
}
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, read, () => "system");
  return (
    <button
      className="button text-sm"
      aria-label={copy.theme(labels[theme])}
      onClick={() => {
        const value = next[theme];
        document.documentElement.dataset.theme = value;
        try {
          localStorage.setItem("bl_theme", value);
        } catch {
          /* Preference still applies when storage is unavailable. */
        }
      }}
    >
      {labels[theme]}
    </button>
  );
}
