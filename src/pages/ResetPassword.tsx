import React, { useState } from "react";
import { VinylDisc } from "../components/VinylDisc";

interface ResetPasswordProps {
  onUpdatePassword: (password: string) => Promise<string | null>;
  onCancel: () => void;
}

export function ResetPassword({ onUpdatePassword, onCancel }: ResetPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const err = await onUpdatePassword(password);
    if (err) {
      setError(err);
      setSubmitting(false);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative" style={{ background: "#09070a" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(255,94,0,0.06) 0%, transparent 70%)" }} />
      <div className="absolute top-8 left-4 opacity-[0.07] pointer-events-none"><VinylDisc size={180} /></div>
      <div className="absolute bottom-16 right-2 opacity-[0.07] pointer-events-none"><VinylDisc size={140} /></div>

      <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-[320px]">
        <h1
          className="font-display leading-none mb-2"
          style={{ fontSize: 64, letterSpacing: "0.04em", color: "#f2e8d2", textShadow: "0 0 60px rgba(255,94,0,0.15),0 4px 32px rgba(0,0,0,0.8)", lineHeight: 0.9 }}
        >
          CRATES
        </h1>

        <div className="flex items-center gap-3 w-full mb-8 mt-5">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="font-display text-[11px]" style={{ color: "#ff5e00", letterSpacing: "0.2em", textShadow: "0 0 8px rgba(255,94,0,0.4)" }}>
            SET NEW PASSWORD
          </span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        {done ? (
          <div className="w-full space-y-4">
            <div className="px-3 py-3 font-mono text-[10px] text-center" style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14" }}>
              PASSWORD UPDATED SUCCESSFULLY
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3.5 font-display text-sm transition-all duration-150 active:scale-[0.97]"
              style={{
                background: "transparent",
                border: "1px solid #ff5e00",
                color: "#ff5e00",
                textShadow: "0 0 8px rgba(255,94,0,0.5)",
                boxShadow: "0 0 6px rgba(255,94,0,0.2),inset 0 0 8px rgba(255,94,0,0.04)",
                letterSpacing: "0.25em",
              }}
            >
              CONTINUE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-2">
            <input
              type="password"
              placeholder="NEW PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full font-mono text-xs px-3 py-2.5 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#f2e8d2", letterSpacing: "0.05em" }}
            />
            <input
              type="password"
              placeholder="CONFIRM PASSWORD"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full font-mono text-xs px-3 py-2.5 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#f2e8d2", letterSpacing: "0.05em" }}
            />
            {error && (
              <div className="px-3 py-2 font-mono text-[10px] text-center" style={{ background: "rgba(180,0,0,0.12)", border: "1px solid rgba(180,0,0,0.3)", color: "#ff6b6b" }}>
                {error}
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
              {submitting ? "..." : "UPDATE PASSWORD"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 font-mono text-[9px] transition-opacity duration-150"
              style={{ color: "#907558", letterSpacing: "0.18em", background: "none" }}
            >
              SKIP
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
