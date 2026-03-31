import React from "react";
import { VinylDisc } from "../components/VinylDisc";

interface LoginProps {
  onLogin: () => void;
  error?: string | null;
}

const POSTERS = [
  { artist: "DAVID BOWIE",      sub: "ZIGGY STARDUST",     detail: "EARLS COURT · 1973", bg: "linear-gradient(160deg,#1a0a1a,#2d0d2d,#1a0a0a)",  accent: "#e040fb", rot: "-3deg"   },
  { artist: "LED ZEPPELIN",     sub: "PHYSICAL GRAFFITI",  detail: "N. AMERICA · 1975",  bg: "linear-gradient(160deg,#1a0a00,#3d1500,#1a0800)",  accent: "#ff6d00", rot: "2deg"    },
  { artist: "FLEETWOOD MAC",    sub: "RUMOURS TOUR",       detail: "WORLD TOUR · 1977",  bg: "linear-gradient(160deg,#001a1a,#002d3d,#001a22)",  accent: "#00e5ff", rot: "-1.5deg" },
  { artist: "NEIL YOUNG",       sub: "HARVEST MOON",       detail: "AMERICA · 1993",     bg: "linear-gradient(160deg,#0a1000,#1e2d00,#0a1500)",  accent: "#aeea00", rot: "3.5deg"  },
  { artist: "THE CLASH",        sub: "LONDON CALLING",     detail: "UK TOUR · 1979",     bg: "linear-gradient(160deg,#1a0000,#3d0000,#1a0808)",  accent: "#ff1744", rot: "-2deg"   },
];

function Poster({ p, w, h, opacity }: { p: typeof POSTERS[0]; w: number; h: number; opacity: number }) {
  return (
    <div
      className="shrink-0 relative overflow-hidden"
      style={{
        width: w, height: h,
        background: p.bg,
        transform: `rotate(${p.rot})`,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "2px 4px 12px rgba(0,0,0,0.7)",
        opacity,
      }}
    >
      <div className="p-2 flex flex-col h-full justify-between">
        <div>
          <p className="font-display text-[8px] leading-none mb-0.5" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em" }}>
            LIVE IN CONCERT
          </p>
          <p className="font-display leading-none" style={{ fontSize: 13, color: p.accent, textShadow: `0 0 8px ${p.accent}`, letterSpacing: "0.05em" }}>
            {p.artist}
          </p>
          <p className="font-display text-[9px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em" }}>
            {p.sub}
          </p>
        </div>
        <p className="font-mono text-[7px]" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
          {p.detail}
        </p>
      </div>
    </div>
  );
}

export function Login({ onLogin, error }: LoginProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative" style={{ background: "#09070a" }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(255,94,0,0.06) 0%, transparent 70%)" }} />

      {/* Background vinyl records */}
      <div className="absolute top-8 left-4 opacity-[0.07] pointer-events-none"><VinylDisc size={180} /></div>
      <div className="absolute bottom-16 right-2 opacity-[0.07] pointer-events-none"><VinylDisc size={140} /></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none"><VinylDisc size={380} /></div>

      {/* Top poster strip */}
      <div className="absolute top-0 left-0 right-0 h-[120px] flex items-start pt-3 px-3 gap-2 overflow-hidden pointer-events-none">
        {POSTERS.slice(0, 4).map((p, i) => <Poster key={i} p={p} w={82} h={104} opacity={0.7} />)}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-[320px]">
        {/* OPEN neon sign */}
        <div
          className="font-display text-[13px] mb-8 animate-neon-flicker"
          style={{ color: "#39ff14", textShadow: "0 0 6px #39ff14,0 0 12px #39ff14,0 0 25px #0fa,0 0 50px #0fa", letterSpacing: "0.45em" }}
        >
          OPEN
        </div>

        {/* Giant wordmark */}
        <h1
          className="font-display leading-none"
          style={{ fontSize: 112, letterSpacing: "0.04em", color: "#f2e8d2", textShadow: "0 0 60px rgba(255,94,0,0.15),0 4px 32px rgba(0,0,0,0.8)", lineHeight: 0.9 }}
        >
          CRATE
        </h1>

        {/* Neon RECORDS */}
        <div
          className="font-display text-[11px] mt-3 mb-2 animate-neon-flicker-slow"
          style={{ color: "#ff0091", textShadow: "0 0 6px #ff0091,0 0 12px #ff0091,0 0 25px #f09", letterSpacing: "0.55em" }}
        >
          RECORDS
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full mb-8 mt-5">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="font-mono text-[9px]" style={{ color: "#907558", letterSpacing: "0.2em" }}>
            INTENTIONAL ALBUM PICKING
          </span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Features */}
        <div className="mb-8 space-y-3 w-full text-left">
          {[
            { icon: "▶", label: "REVISIT YOUR FAVORITES" },
            { icon: "◈", label: "REDISCOVER DEEP CUTS"  },
            { icon: "◉", label: "FIND THE RIGHT VIBE"   },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="font-mono text-xs" style={{ color: "#ff5e00", textShadow: "0 0 8px rgba(255,94,0,0.5)" }}>{icon}</span>
              <span className="font-display text-sm" style={{ color: "#907558", letterSpacing: "0.2em" }}>{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-5 w-full px-3 py-2.5 font-mono text-xs text-center" style={{ background: "rgba(180,0,0,0.12)", border: "1px solid rgba(180,0,0,0.3)", color: "#ff6b6b" }}>
            Authentication failed. Try again.
          </div>
        )}

        {/* Connect button — neon green sign */}
        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 transition-all duration-150 active:scale-[0.97] font-display"
          style={{
            background: "transparent",
            border: "1px solid #39ff14",
            color: "#39ff14",
            textShadow: "0 0 8px #39ff14,0 0 16px #39ff14",
            boxShadow: "0 0 6px rgba(57,255,20,0.3),0 0 14px rgba(57,255,20,0.15),inset 0 0 8px rgba(57,255,20,0.05)",
            fontSize: 14,
            letterSpacing: "0.25em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(57,255,20,0.06)";
            e.currentTarget.style.boxShadow = "0 0 10px rgba(57,255,20,0.5),0 0 24px rgba(57,255,20,0.25),inset 0 0 12px rgba(57,255,20,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.boxShadow = "0 0 6px rgba(57,255,20,0.3),0 0 14px rgba(57,255,20,0.15),inset 0 0 8px rgba(57,255,20,0.05)";
          }}
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          CONNECT WITH SPOTIFY
        </button>

        <p className="mt-5 font-mono text-[9px] leading-relaxed text-center" style={{ color: "#907558", opacity: 0.6, letterSpacing: "0.05em" }}>
          READ-ONLY ACCESS · WE DON'T MODIFY YOUR LIBRARY
        </p>
      </div>

      {/* Bottom poster strip */}
      <div className="absolute bottom-0 left-0 right-0 h-[110px] flex items-end pb-2 px-3 gap-2 overflow-hidden pointer-events-none">
        {POSTERS.slice(2).map((p, i) => <Poster key={i} p={p} w={76} h={96} opacity={0.55} />)}
      </div>
    </div>
  );
}
