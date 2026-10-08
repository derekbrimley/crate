import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileDropdown } from "./library/ProfileDropdown";

interface PageHeaderProps {
  title: string;
  onLogout: () => void;
  /** Where the back arrow goes. Omitted on top-level pages. */
  backTo?: string;
  /** Extra buttons, shown left of the profile button. */
  actions?: React.ReactNode;
}

/** Sticky page header: optional back arrow, title, actions, profile menu. */
export function PageHeader({ title, onLogout, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const isTop = !backTo;

  return (
    <div
      className="sticky top-0 z-40 relative"
      style={{
        background: "rgb(var(--c-surface) / calc(0.97 * var(--tint)))",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgb(var(--c-border))",
      }}
    >
      <div className="max-w-xl lg:max-w-4xl mx-auto flex items-center gap-2" style={{ padding: "10px 12px 9px" }}>
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center justify-center cursor-pointer shrink-0"
            style={{ width: 28, height: 28, color: "rgb(var(--c-accent))", background: "transparent", border: "none" }}
            title="Back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1
          className="font-display flex-1 leading-none truncate"
          style={
            isTop
              ? { fontSize: 22, color: "rgb(var(--c-neon))", letterSpacing: "0.4em", textShadow: "0 0 6px rgb(var(--c-neon)), 0 0 18px #0fa" }
              : { fontSize: 20, color: "rgb(var(--c-text))", letterSpacing: "0.18em" }
          }
        >
          {title.toUpperCase()}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgb(var(--c-knob-hi)), rgb(var(--c-knob-lo)))",
              border: showProfile ? "1.5px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
              color: showProfile ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
              boxShadow: showProfile ? "0 0 10px rgb(var(--c-accent) / calc(0.35 * var(--tint)))" : "none",
            }}
            title="Profile"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </button>
        </div>
      </div>
      {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} onLogout={onLogout} />}
    </div>
  );
}

/** Small square icon button for header actions. */
export function HeaderAction({ onClick, title, children, disabled }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center cursor-pointer disabled:opacity-40"
      style={{
        width: 28,
        height: 28,
        background: "transparent",
        border: "1px solid rgb(var(--c-border))",
        color: "rgb(var(--c-muted))",
      }}
    >
      {children}
    </button>
  );
}
