"use client";

import { Button } from "@/components/ui/button";

interface PlayerControlsProps {
  onSeekBackward: () => void;
  onReplayContext: () => void;
  onSeekForward: () => void;
  onToggleSpeed: () => void;
  playbackRate: number;
  isDisabled: boolean;
  replayContextLabel: string;
  seekBackwardAriaLabel: string;
  seekForwardAriaLabel: string;
  togglePlaybackSpeedAriaLabel: string;
}

export function PlayerControls({
  onSeekBackward,
  onReplayContext,
  onSeekForward,
  onToggleSpeed,
  playbackRate,
  isDisabled,
  replayContextLabel,
  seekBackwardAriaLabel,
  seekForwardAriaLabel,
  togglePlaybackSpeedAriaLabel,
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
        aria-label={replayContextLabel}
      >
        {replayContextLabel}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onSeekBackward}
        disabled={isDisabled}
        aria-label={seekBackwardAriaLabel}
      >
        -5s
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onSeekForward}
        disabled={isDisabled}
        aria-label={seekForwardAriaLabel}
      >
        +5s
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onToggleSpeed}
        disabled={isDisabled}
        className="col-span-2"
        aria-label={togglePlaybackSpeedAriaLabel}
      >
        {`${playbackRate.toFixed(2).replace(".00", "")}x`}
      </Button>
    </div>
  );
}
