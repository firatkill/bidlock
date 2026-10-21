"use client";
import { ErrorView } from "@/components/shell/ErrorView";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorView reset={reset} />
      </body>
    </html>
  );
}
