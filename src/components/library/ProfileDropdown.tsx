import React from "react";
import { useNavigate } from "react-router-dom";

interface ProfileDropdownProps {
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileDropdown({ onClose, onLogout }: ProfileDropdownProps) {
  const navigate = useNavigate();

  const items = [
    { label: "View History", action: () => { onClose(); navigate("/history"); } },
    { label: "Settings", action: () => { onClose(); navigate("/settings"); } },
    { label: "Sign Out", action: onLogout, color: "#ff5555" },
  ];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[29]" />
      <div
        className="absolute top-[52px] right-3 z-30 animate-panel-open"
        style={{
          width: 210,
          background: "#1a1210",
          border: "1px solid #3d2815",
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
              fontSize: 8,
              letterSpacing: "0.1em",
              color: color || "#907558",
              background: "transparent",
              border: "none",
              borderBottom: i < items.length - 1 ? "1px solid #3d2815" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
