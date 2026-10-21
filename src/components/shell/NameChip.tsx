"use client";
import { useEffect, useState } from "react";
import { useMe } from "@/client/hooks/useMe";
import { shellCopy as copy } from "@/domain/copy";
import { NameDialog } from "./NameDialog";
export function NameChip() {
  const me = useMe();
  const [notice, setNotice] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(false);
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);
  if (!me)
    return (
      <div className="h-5 w-[120px] rounded bg-rule">
        <span className="sr-only">{copy.loadingProfile}</span>
      </div>
    );
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span>{copy.profile(me.display_name)}</span>
        <NameDialog
          name={me.display_name}
          saved={() => {
            setNotice(true);
          }}
        />
      </div>
      {me.payment_strikes > 0 && (
        <p className="text-ink-3">{copy.strikes(me.payment_strikes)}</p>
      )}
      <div
        role="status"
        className={
          notice
            ? "fixed bottom-6 right-4 z-50 rounded border border-rule bg-surface px-4 py-3"
            : "sr-only"
        }
      >
        {notice ? copy.name.success : ""}
      </div>
    </div>
  );
}
