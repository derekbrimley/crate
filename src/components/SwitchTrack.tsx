import React from "react";

/**
 * The on/off pill drawn inside a role="switch" button. In the paper theme
 * every color is black, so index.css redraws it there: an outlined white
 * track when off, a solid black one with a white knob when on.
 */
export function SwitchTrack({ on, color = "--c-accent" }: { on: boolean; color?: string }) {
  return (
    <span
      className="switch-track shrink-0 relative transition-colors"
      data-on={on}
      style={{ width: 50, height: 30, borderRadius: 15, background: on ? `rgb(var(${color}))` : "rgb(var(--c-border))" }}
    >
      <span
        className="switch-knob absolute transition-all"
        style={{ top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: "rgb(var(--c-text))" }}
      />
    </span>
  );
}
