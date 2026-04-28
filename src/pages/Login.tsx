import React, { useState } from "react";
import { VinylDisc } from "../components/VinylDisc";

interface LoginProps {
  onEmailLogin: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<string | null>;
  onForgotPassword: (email: string) => Promise<string | null>;
}

export function Login({ onEmailLogin, onSignUp, onForgotPassword }: LoginProps) {
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setSubmitting(true);
    const err = emailMode === "signin"
      ? await onEmailLogin(email, password)
      : await onSignUp(email, password);
    if (err) setEmailError(err);
    setSubmitting(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onForgotPassword(email);
    setForgotSent(true);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative" style={{ background: "#09070a" }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(255,94,0,0.06) 0%, transparent 70%)" }} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-[320px]">

        {/* Giant wordmark */}
        <h1
          className="font-display leading-none"
          style={{ fontSize: 112, letterSpacing: "0.04em", color: "#f2e8d2", textShadow: "0 0 60px rgba(255,94,0,0.15),0 4px 32px rgba(0,0,0,0.8)", lineHeight: 0.9 }}
        >
          CRATES
        </h1>

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

        {/* Sign in / Create account toggle */}
        <div className="flex w-full mb-5">
          {(["signin", "signup"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setEmailMode(mode); setEmailError(null); setForgotMode(false); setForgotSent(false); }}
              className="flex-1 py-2 font-display text-xs transition-all duration-150"
              style={{
                borderBottom: emailMode === mode ? "1px solid #ff5e00" : "1px solid rgba(255,255,255,0.08)",
                color: emailMode === mode ? "#ff5e00" : "#907558",
                textShadow: emailMode === mode ? "0 0 8px rgba(255,94,0,0.4)" : "none",
                letterSpacing: "0.2em",
                background: "none",
              }}
            >
              {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          ))}
        </div>

        {forgotMode ? (
          <div className="w-full space-y-2">
            {forgotSent ? (
              <div className="px-3 py-3 font-mono text-[10px] text-center" style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14", letterSpacing: "0.08em" }}>
                CHECK YOUR EMAIL FOR A RESET LINK
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-2">
                <input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full font-mono text-xs px-3 py-2.5 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#f2e8d2", letterSpacing: "0.05em" }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 font-display text-sm transition-all duration-150 active:scale-[0.97]"
                  style={{
                    background: "transparent",
                    border: "1px solid #ff5e00",
                    color: "#ff5e00",
                    textShadow: "0 0 8px rgba(255,94,0,0.5)",
                    boxShadow: "0 0 6px rgba(255,94,0,0.2),inset 0 0 8px rgba(255,94,0,0.04)",
                    letterSpacing: "0.25em",
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  {submitting ? "..." : "SEND RESET LINK"}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setForgotMode(false); setForgotSent(false); }}
              className="w-full py-2 font-mono text-[9px] transition-opacity duration-150"
              style={{ color: "#907558", letterSpacing: "0.18em", background: "none" }}
            >
              BACK TO SIGN IN
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="w-full space-y-2">
            <input
              type="email"
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full font-mono text-xs px-3 py-2.5 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#f2e8d2", letterSpacing: "0.05em" }}
            />
            <input
              type="password"
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full font-mono text-xs px-3 py-2.5 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#f2e8d2", letterSpacing: "0.05em" }}
            />
            {emailError && (
              <div className="px-3 py-2 font-mono text-[10px] text-center" style={{ background: "rgba(180,0,0,0.12)", border: "1px solid rgba(180,0,0,0.3)", color: "#ff6b6b" }}>
                {emailError}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 font-display text-sm transition-all duration-150 active:scale-[0.97]"
              style={{
                background: "transparent",
                border: "1px solid #ff5e00",
                color: "#ff5e00",
                textShadow: "0 0 8px rgba(255,94,0,0.5)",
                boxShadow: "0 0 6px rgba(255,94,0,0.2),inset 0 0 8px rgba(255,94,0,0.04)",
                letterSpacing: "0.25em",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "..." : emailMode === "signin" ? "ENTER" : "CREATE ACCOUNT"}
            </button>
            {emailMode === "signin" && (
              <button
                type="button"
                onClick={() => { setForgotMode(true); setEmailError(null); }}
                className="w-full py-1 font-mono text-[9px] transition-opacity duration-150"
                style={{ color: "#907558", letterSpacing: "0.18em", background: "none" }}
              >
                FORGOT PASSWORD?
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
