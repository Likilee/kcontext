"use client";

import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
}

function isTextInputElement(element: HTMLElement | null): boolean {
  return (
    element?.tagName === "INPUT" ||
    element?.tagName === "TEXTAREA" ||
    element?.isContentEditable === true ||
    element?.getAttribute("role") === "textbox"
  );
}

export function useKeyboardShortcuts({
  onPrevious,
  onNext,
  onReplay,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputElement(event.target as HTMLElement | null)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
        return;
      }

      if (event.key === "r" || event.key === "R" || event.key === " ") {
        event.preventDefault();
        onReplay();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onNext, onPrevious, onReplay]);
}
