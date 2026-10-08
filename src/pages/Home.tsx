import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader } from "../components/PageHeader";
import { useLibraryData } from "../hooks/useLibraryData";
import { usePlayer } from "../hooks/usePlayer";

interface HomeProps {
  onLogout: () => void;
}

/** The three ways in: a crate, a search, or something new. */
export function Home({ onLogout }: HomeProps) {
  const navigate = useNavigate();
  const { crateDefs, recommendations, ready } = useLibraryData();
  const { currentTrack } = usePlayer();
  const crateCount = crateDefs.length;

  return (
    <Layout>
      <PageHeader title="Crates" onLogout={onLogout} />
      {/* The tiles share the screen between header and nav (and the player bar
          when something is playing), so there's no dead space below them. */}
      <div
        className="flex flex-col gap-3"
        style={{ padding: "14px 12px", height: `calc(100dvh - 49px - ${currentTrack ? 176 : 96}px)`, minHeight: 500 }}
      >
        <HomeTile
          label="CRATES"
          blurb="Dig through a crate, best bets first"
          meta={ready ? `${crateCount} crate${crateCount === 1 ? "" : "s"}` : null}
          color="--c-accent"
          onClick={() => navigate("/crates")}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18l-1.5 12.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L3 7zM3 7l2-3h14l2 3M9 11v5M15 11v5" />
          }
        />
        <HomeTile
          label="SEARCH"
          blurb="Find an album or one of your playlists"
          meta={null}
          color="--c-neon"
          onClick={() => navigate("/add")}
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
        />
        <HomeTile
          label="DISCOVER"
          blurb="Recommendations, least heard first"
          meta={ready ? `${recommendations.length} rec${recommendations.length === 1 ? "" : "s"}` : null}
          color="--c-rec"
          onClick={() => navigate("/discover")}
          icon={
            <>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
            </>
          }
        />
      </div>
    </Layout>
  );
}

function HomeTile({ label, blurb, meta, color, icon, onClick }: {
  label: string;
  blurb: string;
  meta: string | null;
  /** Theme color token, e.g. "--c-accent". */
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const c = `rgb(var(${color}))`;
  return (
    <button
      onClick={onClick}
      className="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer transition-transform duration-150 active:scale-[0.98]"
      style={{
        minHeight: 150,
        padding: "18px 20px",
        background: `radial-gradient(ellipse at 50% 40%, rgb(var(${color}) / calc(0.16 * var(--tint))) 0%, rgb(var(--c-elevated)) 75%)`,
        border: `1.5px solid rgb(var(${color}) / calc(0.55 * var(--tint)))`,
        boxShadow: `0 4px 22px rgba(0,0,0,0.55), inset 0 0 28px rgb(var(${color}) / calc(0.08 * var(--tint)))`,
      }}
    >
      {/* Oversized faint copy of the icon, so the tile reads as a poster, not a form field. */}
      <svg
        className="absolute pointer-events-none"
        style={{ right: -28, bottom: -36, width: 190, height: 190, color: c, opacity: 0.07 }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}
      >
        {icon}
      </svg>

      {meta && (
        <span
          className="absolute font-mono"
          style={{ top: 12, right: 14, fontSize: 12, color: c, letterSpacing: "0.1em", opacity: 0.85 }}
        >
          {meta}
        </span>
      )}

      <svg
        width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
        style={{ color: c, filter: `drop-shadow(0 0 8px rgb(var(${color}) / calc(0.75 * var(--tint)))) drop-shadow(0 0 22px rgb(var(${color}) / calc(0.35 * var(--tint))))` }}
      >
        {icon}
      </svg>
      <span
        className="block font-display leading-none mt-3"
        style={{ fontSize: 38, color: c, letterSpacing: "0.24em", textShadow: `0 0 14px rgb(var(${color}) / calc(0.45 * var(--tint)))` }}
      >
        {label}
      </span>
      <span className="block font-mono mt-2.5" style={{ fontSize: 13, color: "rgb(var(--c-muted))", letterSpacing: "0.02em" }}>
        {blurb}
      </span>
    </button>
  );
}
