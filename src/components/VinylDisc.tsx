import React from "react";

interface VinylDiscProps {
  size?: number;
  labelColor?: string;
  isSpinning?: boolean;
  className?: string;
}

export function VinylDisc({
  size = 80,
  labelColor = "#c4892a",
  isSpinning = false,
  className = "",
}: VinylDiscProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${isSpinning ? "animate-spin-vinyl" : ""} ${className}`}
      style={{ display: "block" }}
    >
      {/* Main disc */}
      <circle cx="50" cy="50" r="49" fill="#0f0f0f" />
      {/* Outer rim highlight */}
      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Grooves — concentric circles at decreasing radii */}
      {[46, 43, 40, 37, 34, 31, 28, 25, 22, 19].map((r, i) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`rgba(255,255,255,${i % 2 === 0 ? 0.055 : 0.025})`}
          strokeWidth="1"
        />
      ))}
      {/* Record label */}
      <circle cx="50" cy="50" r="14" fill={labelColor} />
      {/* Label shine ring */}
      <circle cx="50" cy="50" r="13.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
      {/* Label text lines (decorative) */}
      <line x1="38" y1="47" x2="62" y2="47" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <line x1="38" y1="50" x2="62" y2="50" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <line x1="38" y1="53" x2="62" y2="53" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      {/* Center spindle hole */}
      <circle cx="50" cy="50" r="2.5" fill="#000" />
      {/* Surface gloss highlight */}
      <ellipse
        cx="32"
        cy="28"
        rx="10"
        ry="5"
        fill="rgba(255,255,255,0.04)"
        transform="rotate(-35, 32, 28)"
      />
    </svg>
  );
}
