import type { ReactNode } from "react";
import Link from "next/link";
import { shellCopy as copy } from "@/domain/copy";
import { NameChip } from "./NameChip";
import { ThemeToggle } from "./ThemeToggle";
export function Shell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "on" | "readonly" | "off";
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-rule py-6">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          {copy.wordmark}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="/how-it-works">{copy.how}</a>
          <a href="https://github.com/firatkill/bidlock" rel="noopener">
            {copy.github}
          </a>
          <ThemeToggle />
        </nav>
        {mode !== "off" && (
          <div className="w-full sm:w-auto">
            <NameChip />
          </div>
        )}
      </header>
      {mode === "readonly" && (
        <p
          role="status"
          className="mt-6 rounded border border-rule bg-surface p-4 text-sm"
        >
          {copy.readonly}
        </p>
      )}
      <div className="flex-1 py-10 sm:py-16">{children}</div>
      <footer className="flex flex-wrap justify-between gap-4 border-t border-rule py-6 text-sm text-ink-3">
        <p>{copy.footer}</p>
        <div className="flex gap-5">
          <a href="https://github.com/firatkill/bidlock" rel="noopener">
            {copy.source}
          </a>
          <a href="https://firatkil.com">{copy.website}</a>
        </div>
      </footer>
    </div>
  );
}
