import React, { useState } from "react";

interface GenrePickerProps {
  selected: string[];
  onChange: (genres: string[]) => void;
  available: string[];
}

export function GenrePicker({ selected, onChange, available }: GenrePickerProps) {
  const [filter, setFilter] = useState("");

  const toggle = (genre: string) => {
    if (selected.includes(genre)) {
      onChange(selected.filter((g) => g !== genre));
    } else {
      onChange([...selected, genre]);
    }
  };

  const lower = filter.toLowerCase();
  const filtered = available.filter((g) => g.toLowerCase().includes(lower));

  // Selected genres float to top
  const sorted = [
    ...filtered.filter((g) => selected.includes(g)),
    ...filtered.filter((g) => !selected.includes(g)),
  ];

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="filter genres..."
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(61,40,21,0.8)",
          borderRadius: 4,
          color: "#f2e8d2",
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          padding: "5px 9px",
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
            color: "#907558",
            letterSpacing: "0.12em",
            padding: "6px 0",
          }}
        >
          No genres found
        </p>
      ) : (
        <div
          className="flex flex-wrap gap-1.5 overflow-y-auto"
          style={{ maxHeight: 160 }}
        >
          {sorted.map((genre) => {
            const isActive = selected.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggle(genre)}
                style={{
                  padding: "3px 8px",
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  border: isActive ? "1px solid #ff5e00" : "1px solid rgba(61,40,21,0.8)",
                  background: isActive ? "rgba(255,94,0,0.12)" : "transparent",
                  color: isActive ? "#ff5e00" : "#907558",
                  textShadow: isActive ? "0 0 8px rgba(255,94,0,0.5)" : "none",
                  boxShadow: isActive ? "0 0 6px rgba(255,94,0,0.15)" : "none",
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
