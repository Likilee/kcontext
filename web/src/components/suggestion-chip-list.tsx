"use client";

import { Button } from "@/components/ui/button";

interface SuggestionChipListProps {
  suggestions: readonly string[];
  onSelect: (keyword: string) => void;
  wrap?: boolean;
}

export function SuggestionChipList({
  suggestions,
  onSelect,
  wrap = false,
}: SuggestionChipListProps) {
  return (
    <div
      className={[
        "gap-[var(--space-gap-item)]",
        wrap ? "flex flex-wrap justify-center" : "flex overflow-x-auto pb-[var(--space-gap-micro)]",
      ].join(" ")}
    >
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion}
          type="button"
          variant="default"
          size="compact"
          onClick={() => onSelect(suggestion)}
          className="text-[length:var(--font-size-13)] text-[var(--text-secondary)]"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
