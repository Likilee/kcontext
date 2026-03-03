"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (keyword: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [value, setValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch(value);
    }
  };

  return (
    <div className="flex flex-row items-center gap-[var(--space-gap-micro)] bg-[var(--bg-surface)] rounded-[var(--radius-pill)] px-[var(--space-inset-squish-x)] py-[var(--space-inset-squish-y)] focus-within:ring-1 focus-within:ring-[var(--border-focus)]">
      <span className="text-[var(--text-secondary)] shrink-0">
        {isLoading ? (
          <div className="size-5 rounded-full border-2 border-[var(--text-secondary)] border-t-transparent animate-spin" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search for real Korean (e.g. 진짜 행복해요, 어쩔티비)"
        className="flex-1 bg-transparent outline-none text-[var(--text-primary)] text-[length:var(--font-size-16)] font-[family-name:var(--font-family-sans)] placeholder:text-[var(--text-disabled)]"
        aria-label="Search for real Korean"
      />
    </div>
  );
}
