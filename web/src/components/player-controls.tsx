"use client";

import { Button } from "@/components/ui/button";

interface PlayerControlsProps {
  onSeekBackward: () => void;
  onReplayContext: () => void;
  onSeekForward: () => void;
  onToggleSpeed: () => void;
  playbackRate: number;
  isDisabled: boolean;
}

export function PlayerControls({
  onSeekBackward,
  onReplayContext,
  onSeekForward,
  onToggleSpeed,
  playbackRate,
  isDisabled,
}: PlayerControlsProps) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-gap-item)]">
      <Button
        type="button"
        variant="accent"
        data-testid="replay-context-btn"
        onClick={onReplayContext}
        disabled={isDisabled}
        className="col-span-2 font-semibold"
        aria-label="Replay context"
      >
        Replay context
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onSeekBackward}
        disabled={isDisabled}
        aria-label="Seek backward 5 seconds"
      >
        -5s
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onSeekForward}
        disabled={isDisabled}
        aria-label="Seek forward 5 seconds"
      >
        +5s
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onToggleSpeed}
        disabled={isDisabled}
        className="col-span-2"
        aria-label="Toggle playback speed"
      >
        {`${playbackRate.toFixed(2).replace(".00", "")}x`}
      </Button>
    </div>
  );
}
