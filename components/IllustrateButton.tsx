"use client";

import { useState } from "react";

export default function IllustrateButton({
  disabled,
  onRequest,
}: {
  disabled: boolean;
  onRequest: (subject: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");

  function submit() {
    if (!subject.trim()) return;
    onRequest(subject.trim());
    setSubject("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded border border-amber-700/40 px-3 py-2 text-sm text-amber-100 hover:bg-amber-900/30 disabled:opacity-50"
      >
        🎨 Illustrate this
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="What should the DM illustrate?"
        className="w-56 rounded border border-amber-700/40 bg-black/30 px-2 py-2 text-sm text-amber-50"
      />
      <button
        onClick={submit}
        disabled={disabled}
        className="rounded bg-amber-700 px-3 py-2 text-sm text-amber-50 hover:bg-amber-600 disabled:opacity-50"
      >
        Go
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-amber-200/50 underline"
      >
        cancel
      </button>
    </div>
  );
}
