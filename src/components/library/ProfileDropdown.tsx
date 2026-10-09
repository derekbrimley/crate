import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../lib/theme";
import { HouseholdTokensModal } from "./HouseholdTokensModal";

interface ProfileDropdownProps {
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileDropdown({ onClose, onLogout }: ProfileDropdownProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showTokens, setShowTokens] = useState(false);

  if (showTokens) return <HouseholdTokensModal onClose={onClose} />;

  const items = [
    { label: "View History", action: () => { onClose(); navigate("/history"); } },
    { label: "Import from Spotify", action: () => { onClose(); navigate("/import"); } },
    { label: theme === "paper" ? "Display: Paper (high contrast)" : "Display: Neon", action: toggleTheme },
    { label: "Household Tokens", action: () => setShowTokens(true) },
    { label: "Sign Out", action: onLogout, color: "rgb(var(--c-danger))" },
  ];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[29]" />
      <div
        className="absolute top-[52px] right-3 z-30 animate-panel-open"
        style={{
          width: 210,
          background: "rgb(var(--c-elevated))",
          border: "1px solid rgb(var(--c-border))",
          boxShadow: "0 8px 32px rgba(0,0,0,0.85)",
        }}
      >
        {items.map(({ label, action, color }, i) => (
          <button
            key={label}
            onClick={action}
            className="block w-full text-left font-mono cursor-pointer"
            style={{
              padding: "9px 14px",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: color || "rgb(var(--c-muted))",
              background: "transparent",
              border: "none",
              borderBottom: i < items.length - 1 ? "1px solid rgb(var(--c-border))" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
