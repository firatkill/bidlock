import type { ReactNode } from "react";
import Link from "next/link";
import { shellCopy as copy } from "@/domain/copy";
import { NameChip } from "./NameChip";
import { HeaderMenu } from "./HeaderMenu";
export function Shell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "on" | "readonly" | "off";
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-8">
      <header className="relative flex items-center justify-between gap-2 border-b border-rule py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-2xl font-bold tracking-tight"
        >
          {copy.wordmark}
        </Link>
        {mode !== "off" && (
          <div className="min-w-0">
            <NameChip />
          </div>
        )}
        <HeaderMenu />
      </header>
      {mode === "readonly" && (
        <p
          role="status"
          className="mt-6 rounded border border-rule bg-surface p-4 text-sm"
        >
          {copy.readonly}
        </p>
      )}
      <div className="flex-1 py-6 sm:py-8">{children}</div>
      <footer className="flex flex-wrap justify-between gap-4 border-t border-rule py-6 text-sm text-ink-3">
        <p>{copy.footer}</p>
        <div className="flex gap-5 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
          <a href="https://github.com/firatkill/bidlock" rel="noopener">
            {copy.source}
          </a>
          <a href="https://firatkil.com">{copy.website}</a>
        </div>
      </footer>
    </div>
  );
}
