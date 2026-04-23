import React from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  {
    to: "/",
    label: "CRATES",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    to: "/library",
    label: "LIBRARY",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 6h2v14H3V6zm4 0h2v14H7V6zm4 0h2v14h-2V6zm4-2h2v16h-2V4zm4 1h2v14h-2V5z"
        />
      </svg>
    ),
  },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-crate-border"
      style={{
        background: "rgba(15,10,12,0.97)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.6)",
      }}
    >
      <div className="flex max-w-xl mx-auto">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className="flex-1">
            {({ isActive }) => (
              <span className="flex flex-col items-center gap-1 pt-3 pb-2 w-full transition-all duration-200">
                <span
                  className="transition-all duration-200"
                  style={{
                    color: isActive ? "#ff5e00" : "#907558",
                    filter: isActive
                      ? "drop-shadow(0 0 6px rgba(255,94,0,0.7)) drop-shadow(0 0 12px rgba(255,94,0,0.4))"
                      : "none",
                  }}
                >
                  {icon}
                </span>
                <span
                  className="font-display text-[11px] transition-all duration-200"
                  style={{
                    color: isActive ? "#ff5e00" : "#907558",
                    letterSpacing: "0.18em",
                    textShadow: isActive ? "0 0 8px rgba(255,94,0,0.6)" : "none",
                  }}
                >
                  {label}
                </span>
                <span
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: 3,
                    height: 3,
                    background: isActive ? "#ff5e00" : "transparent",
                    boxShadow: isActive ? "0 0 6px #ff5e00, 0 0 12px #ff5e00" : "none",
                  }}
                />
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
