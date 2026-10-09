import React, { useState } from "react";

interface GenrePickerProps {
  selected: string[];
  onChange: (genres: string[]) => void;
  available: string[];
  /** Touch-sized input and chips. */
  large?: boolean;
}

export function GenrePicker({ selected, onChange, available, large = false }: GenrePickerProps) {
  const [filter, setFilter] = useState("");
  // The genres floated to the top: those selected when the picker opened or the
  // filter last changed. Clicking a chip doesn't re-sort, so it stays in place
  // and you don't lose your spot in the list.
  const [pinned, setPinned] = useState(selected);

  const toggle = (genre: string) => {
    if (selected.includes(genre)) {
      onChange(selected.filter((g) => g !== genre));
    } else {
      onChange([...selected, genre]);
    }
  };

  const lower = filter.toLowerCase();
  const filtered = available.filter((g) => g.toLowerCase().includes(lower));

  const sorted = [
    ...filtered.filter((g) => pinned.includes(g)),
    ...filtered.filter((g) => !pinned.includes(g)),
  ];

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setPinned(selected);
        }}
        placeholder="filter genres..."
        style={{
          background: "rgb(var(--c-hi) / calc(0.03 * var(--tint-hi)))",
          border: "1px solid rgb(var(--c-border) / calc(0.8 * var(--tint)))",
          borderRadius: 4,
          color: "rgb(var(--c-text))",
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: large ? 16 : 11,
          padding: large ? "9px 12px" : "5px 9px",
          width: "100%",
          outline: "none",
          marginBottom: 8,
        }}
      />

      {sorted.length === 0 ? (
        <p
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 10,
            color: "rgb(var(--c-muted))",
            letterSpacing: "0.12em",
            padding: "6px 0",
          }}
        >
          No genres found
        </p>
      ) : (
        <div
          className="flex flex-wrap gap-1.5 overflow-y-auto"
          style={{ maxHeight: large ? 220 : 160 }}
        >
          {sorted.map((genre) => {
            const isActive = selected.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggle(genre)}
                style={{
                  padding: large ? "8px 12px" : "3px 8px",
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: large ? 13 : 10,
                  letterSpacing: "0.1em",
                  border: isActive ? "1px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border) / calc(0.8 * var(--tint)))",
                  background: isActive ? "rgb(var(--c-accent) / calc(0.12 * var(--tint)))" : "transparent",
                  color: isActive ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
                  textShadow: isActive ? "0 0 8px rgb(var(--c-accent) / calc(0.5 * var(--tint)))" : "none",
                  boxShadow: isActive ? "0 0 6px rgb(var(--c-accent) / calc(0.15 * var(--tint)))" : "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "all 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
