"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type SubmitEvent } from "react";
import { normalizeName, validateName } from "@/domain/names";
import { shellCopy as copy } from "@/domain/copy";
import { updateName } from "@/client/hooks/useMe";
import { ApiError } from "@/client/api";
export function NameDialog({
  name,
  saved,
  initialOpen = false,
}: {
  name: string;
  saved: () => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen),
    [value, setValue] = useState(name),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const normalized = normalizeName(value);
    const reason = validateName(normalized);
    if (reason) {
      setError(copy.name[reason]);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateName(normalized);
      setOpen(false);
      saved();
    } catch (cause: unknown) {
      const reason =
        cause instanceof ApiError
          ? cause.envelope.error.details?.reason
          : undefined;
      setError(
        reason === "length" ||
          reason === "characters" ||
          reason === "profanity" ||
          reason === "bot_suffix"
          ? copy.name[reason]
          : copy.name.failure,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          setValue(name);
          setError(null);
        }
      }}
    >
      <Dialog.Trigger className="text-accent underline">
        {copy.edit}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-rule bg-surface p-6">
          <Dialog.Title className="text-xl font-bold">
            {copy.name.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-2">
            {copy.name.help}
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="display-name"
                className="mb-2 block text-sm font-medium"
              >
                {copy.name.label}
              </label>
              <input
                id="display-name"
                className="field"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
                disabled={pending}
                autoComplete="nickname"
                aria-invalid={!!error}
                aria-describedby={error ? "name-error" : undefined}
              />
            </div>
            {error && (
              <p id="name-error" role="alert" className="text-sm text-warn">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Dialog.Close className="button" disabled={pending}>
                {copy.name.cancel}
              </Dialog.Close>
              <button className="button button-primary" disabled={pending}>
                {pending ? copy.name.saving : copy.name.save}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
