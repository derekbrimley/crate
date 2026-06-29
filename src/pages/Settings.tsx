import React, { useState } from "react";
import { Layout } from "../components/Layout";
import { ProfileDropdown } from "../components/library/ProfileDropdown";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[9px] text-crate-muted tracking-widest uppercase mb-3"
      style={{ letterSpacing: "0.22em" }}
    >
      {children}
    </p>
  );
}

interface SettingsProps {
  onLogout: () => void;
}

export function Settings({ onLogout }: SettingsProps) {
  const [showProfile, setShowProfile] = useState(false);

  const profileButton = (
    <div className="relative">
      <button
        onClick={() => setShowProfile((v) => !v)}
        className="flex items-center justify-center cursor-pointer"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #3a2010, #261406)",
          border: showProfile ? "1.5px solid #ff5e00" : "1px solid #3d2815",
          color: showProfile ? "#ff5e00" : "#907558",
          boxShadow: showProfile ? "0 0 10px rgba(255,94,0,0.35)" : "none",
        }}
        title="Profile"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      </button>
      {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} onLogout={onLogout} />}
    </div>
  );

  return (
    <Layout title="Settings" headerRight={profileButton}>
      <div className="px-5 pt-6">
        <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: "#907558", lineHeight: 1.6 }}>
          Crate selection settings now live on each crate — edit a crate from the Crates tab.
        </p>
      </div>
    </Layout>
  );
}
