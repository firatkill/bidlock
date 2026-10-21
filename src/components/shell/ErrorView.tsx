"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Id } from "@/domain/schemas";
import { request } from "@/client/api";
import { shellCopy as copy } from "@/domain/copy";
export function ErrorView({ reset }: { reset: () => void }) {
  const started = useRef(false);
  const [reportedId, setReportedId] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const error_id = crypto.randomUUID();
    void request("/api/client-errors", z.object({ request_id: Id }).strict(), {
      method: "POST",
      body: JSON.stringify({ error_id }),
    })
      .then((result) => {
        if (result.request_id === error_id) setReportedId(error_id);
      })
      .catch(() => {});
  }, []);
  return (
    <main>
      <h1>{copy.error}</h1>
      {reportedId && (
        <p className="mt-4 break-all text-ink-2">{copy.errorId(reportedId)}</p>
      )}
      <button className="button mt-6" onClick={reset}>
        {copy.reload}
      </button>
    </main>
  );
}
