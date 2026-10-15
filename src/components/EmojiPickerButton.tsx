"use client";

import { useEffect, useRef, useState } from "react";

type EmojiPickerButtonProps = {
  onSelect: (emoji: string) => void;
  label: string;
};

export default function EmojiPickerButton({ onSelect, label }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let picker: HTMLElement | null = null;
    const host = hostRef.current;

    const handleEmojiClick = (event: Event) => {
      const unicode = (event as CustomEvent<{ unicode?: string }>).detail?.unicode;
      if (unicode) onSelectRef.current(unicode);
      setOpen(false);
    };

    // The web component is registered lazily so it never loads for users who don't open it.
    void import("emoji-picker-element").then(() => {
      if (cancelled || !host) return;
      picker = document.createElement("emoji-picker");
      picker.addEventListener("emoji-click", handleEmojiClick);
      host.appendChild(picker);
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      picker?.removeEventListener("emoji-click", handleEmojiClick);
      picker?.remove();
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm leading-none text-slate-700 transition-colors hover:bg-slate-50"
      >
        😀
      </button>
      {open && <div ref={hostRef} className="absolute right-0 z-30 mt-2 shadow-xl" />}
    </div>
  );
}
