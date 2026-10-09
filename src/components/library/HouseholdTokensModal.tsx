import React, { useEffect, useState } from "react";
import { createHouseholdToken, getHouseholdTokens, revokeHouseholdToken, type HouseholdToken } from "../../services/api";

interface Props {
  onClose: () => void;
}

// Household tokens let a shared device (the kitchen dashboard) see your crates
// and start playback without being able to edit anything. The secret is shown
// once, here, and never again.
export function HouseholdTokensModal({ onClose }: Props) {
  const [tokens, setTokens] = useState<HouseholdToken[]>([]);
  const [name, setName] = useState("Kitchen tablet");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { tokens } = await getHouseholdTokens();
      setTokens(tokens);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true); setError(null); setCopied(false);
    try {
      const created = await createHouseholdToken(name);
      setFresh({ name: created.name, token: created.token });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: number) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await revokeHouseholdToken(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const fmt = (sec: number | null) => (sec ? new Date(sec * 1000).toLocaleDateString() : "never");

  const label: React.CSSProperties = { fontSize: 10, letterSpacing: "0.1em", color: "rgb(var(--c-muted))" };
  const button: React.CSSProperties = {
    padding: "8px 12px", fontSize: 10, letterSpacing: "0.1em",
    background: "transparent", color: "rgb(var(--c-text))",
    border: "1px solid rgb(var(--c-border))", cursor: "pointer",
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[40]" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div
        className="fixed z-[41] font-mono animate-panel-open"
        style={{
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(520px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
          background: "rgb(var(--c-elevated))", border: "1px solid rgb(var(--c-border))",
          boxShadow: "0 8px 32px rgba(0,0,0,0.85)", padding: 18, color: "rgb(var(--c-text))",
        }}
      >
        <div style={{ ...label, marginBottom: 6 }}>HOUSEHOLD TOKENS</div>
        <p style={{ fontSize: 11, lineHeight: 1.5, color: "rgb(var(--c-muted))", margin: "0 0 14px" }}>
          A token lets a shared device, like the kitchen dashboard, see your crates and start
          an album on a speaker. It can never add, remove or search. The secret is shown once.
        </p>

        {fresh && (
          <div style={{ border: "1px solid rgb(var(--c-accent))", padding: 12, marginBottom: 14 }}>
            <div style={{ ...label, marginBottom: 6 }}>NEW TOKEN · {fresh.name.toUpperCase()}</div>
            <code style={{ display: "block", fontSize: 11, wordBreak: "break-all", userSelect: "all", marginBottom: 10 }}>
              {fresh.token}
            </code>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={button} onClick={copy}>{copied ? "COPIED" : "COPY"}</button>
              <span style={{ fontSize: 10, color: "rgb(var(--c-muted))" }}>Paste it into the dashboard's settings. It will not be shown again.</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            id="household-token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Kitchen tablet"
            style={{
              flex: 1, fontSize: 11, padding: "8px 10px", background: "rgb(var(--c-surface))",
              color: "rgb(var(--c-text))", border: "1px solid rgb(var(--c-border))", fontFamily: "inherit",
            }}
          />
          <button style={{ ...button, borderColor: "rgb(var(--c-accent))" }} onClick={create} disabled={busy}>
            {busy ? "…" : "CREATE"}
          </button>
        </div>

        <div style={{ ...label, marginBottom: 6 }}>ACTIVE</div>
        {tokens.length === 0 && <div style={{ fontSize: 11, color: "rgb(var(--c-muted))" }}>No tokens yet.</div>}
        {tokens.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgb(var(--c-border))", fontSize: 11 }}>
            <div style={{ flex: 1 }}>
              <div>{t.name}</div>
              <div style={{ fontSize: 10, color: "rgb(var(--c-muted))" }}>
                {t.scopes.join(" + ")} · created {fmt(t.created_at)} · last used {fmt(t.last_used_at)}
              </div>
            </div>
            <button style={{ ...button, color: "rgb(var(--c-danger))" }} onClick={() => revoke(t.id)} disabled={busy}>REVOKE</button>
          </div>
        ))}

        {error && <div style={{ fontSize: 11, color: "rgb(var(--c-danger))", marginTop: 10 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button style={button} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </>
  );
}
