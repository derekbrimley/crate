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
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative" style={{ background: "rgb(var(--c-bg))" }}>
      <div className="ambient-glow absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgb(var(--c-accent) / calc(0.06 * var(--tint))) 0%, transparent 70%)" }} />
      <div className="absolute top-8 left-4 opacity-[0.07] pointer-events-none"><VinylDisc size={180} /></div>
      <div className="absolute bottom-16 right-2 opacity-[0.07] pointer-events-none"><VinylDisc size={140} /></div>

      <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-[320px]">
        <h1
          className="font-display leading-none mb-2"
          style={{ fontSize: 64, letterSpacing: "0.04em", color: "rgb(var(--c-text))", textShadow: "0 0 60px rgb(var(--c-accent) / calc(0.15 * var(--tint))),0 4px 32px rgba(0,0,0,0.8)", lineHeight: 0.9 }}
        >
          CRATES
        </h1>

        <div className="flex items-center gap-3 w-full mb-8 mt-5">
          <div className="flex-1 h-px" style={{ background: "rgb(var(--c-hi) / calc(0.07 * var(--tint-hi)))" }} />
          <span className="font-display text-[11px]" style={{ color: "rgb(var(--c-accent))", letterSpacing: "0.2em", textShadow: "0 0 8px rgb(var(--c-accent) / calc(0.4 * var(--tint)))" }}>
            SET NEW PASSWORD
          </span>
          <div className="flex-1 h-px" style={{ background: "rgb(var(--c-hi) / calc(0.07 * var(--tint-hi)))" }} />
        </div>

        {done ? (
          <div className="w-full space-y-4">
            <div className="px-3 py-3 font-mono text-[10px] text-center" style={{ background: "rgb(var(--c-neon) / calc(0.06 * var(--tint)))", border: "1px solid rgb(var(--c-neon) / calc(0.2 * var(--tint)))", color: "rgb(var(--c-neon))" }}>
              PASSWORD UPDATED SUCCESSFULLY
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3.5 font-display text-sm transition-all duration-150 active:scale-[0.97]"
              style={{
                background: "transparent",
                border: "1px solid rgb(var(--c-accent))",
                color: "rgb(var(--c-accent))",
                textShadow: "0 0 8px rgb(var(--c-accent) / calc(0.5 * var(--tint)))",
                boxShadow: "0 0 6px rgb(var(--c-accent) / calc(0.2 * var(--tint))),inset 0 0 8px rgb(var(--c-accent) / calc(0.04 * var(--tint)))",
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
              style={{ background: "rgb(var(--c-hi) / calc(0.04 * var(--tint-hi)))", border: "1px solid rgb(var(--c-hi) / calc(0.1 * var(--tint-hi)))", color: "rgb(var(--c-text))", letterSpacing: "0.05em" }}
            />
            <input
              type="password"
              placeholder="CONFIRM PASSWORD"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full font-mono text-xs px-3 py-2.5 outline-none"
              style={{ background: "rgb(var(--c-hi) / calc(0.04 * var(--tint-hi)))", border: "1px solid rgb(var(--c-hi) / calc(0.1 * var(--tint-hi)))", color: "rgb(var(--c-text))", letterSpacing: "0.05em" }}
            />
            {error && (
              <div className="px-3 py-2 font-mono text-[10px] text-center" style={{ background: "rgb(var(--c-danger-deep) / calc(0.12 * var(--tint)))", border: "1px solid rgb(var(--c-danger-deep) / calc(0.3 * var(--tint)))", color: "rgb(var(--c-danger))" }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 font-display text-sm transition-all duration-150 active:scale-[0.97]"
              style={{
                background: "transparent",
                border: "1px solid rgb(var(--c-accent))",
                color: "rgb(var(--c-accent))",
                textShadow: "0 0 8px rgb(var(--c-accent) / calc(0.5 * var(--tint)))",
                boxShadow: "0 0 6px rgb(var(--c-accent) / calc(0.2 * var(--tint))),inset 0 0 8px rgb(var(--c-accent) / calc(0.04 * var(--tint)))",
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
              style={{ color: "rgb(var(--c-muted))", letterSpacing: "0.18em", background: "none" }}
            >
              SKIP
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
