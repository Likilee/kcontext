"use client";

interface PlayerControlsProps {
  onReplayContext: () => void;
  isDisabled: boolean;
}

export function PlayerControls({ onReplayContext, isDisabled }: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-center gap-[var(--space-gap-item)]">
      <button
        type="button"
        data-testid="replay-context-btn"
        onClick={onReplayContext}
        disabled={isDisabled}
        className={[
          "min-w-[48px] min-h-[48px] flex flex-col items-center justify-center gap-[var(--space-gap-micro)]",
          "active:scale-[0.96] transition-transform duration-[var(--duration-fast)]",
          isDisabled
            ? "text-[var(--text-disabled)] cursor-not-allowed pointer-events-none"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        ].join(" ")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 1 9 9" />
          <polyline points="1 17 3 12 8 14" />
        </svg>
        <span className="text-[length:var(--font-size-13)] font-[family-name:var(--font-family-sans)]">
          Replay context
        </span>
      </button>
    </div>
  );
}
