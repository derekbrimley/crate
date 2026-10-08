import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader } from "../components/PageHeader";
import { useLibraryData } from "../hooks/useLibraryData";
import { isBrowsableCrate } from "../lib/crateBrowse";

interface HomeProps {
  onLogout: () => void;
}

/** The three ways in: a crate, a search, or something new. */
export function Home({ onLogout }: HomeProps) {
  const navigate = useNavigate();
  const { crateDefs, recommendations, ready } = useLibraryData();
  const crateCount = crateDefs.filter(isBrowsableCrate).length;

  return (
    <Layout>
      <PageHeader title="Crates" onLogout={onLogout} />
      <div className="flex flex-col gap-3" style={{ padding: "22px 12px 100px" }}>
        <HomeTile
          label="CRATES"
          blurb="Pick a crate and dig through it, best bets first."
          meta={ready ? `${crateCount} crate${crateCount === 1 ? "" : "s"}` : null}
          color="--c-accent"
          onClick={() => navigate("/crates")}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18l-1.5 12.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L3 7zM3 7l2-3h14l2 3M9 11v5M15 11v5" />
          }
        />
        <HomeTile
          label="SEARCH"
          blurb="Find an album or one of your playlists."
          meta={null}
          color="--c-neon"
          onClick={() => navigate("/add")}
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
        />
        <HomeTile
          label="DISCOVER"
          blurb="Your recommendations, least heard first."
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
      className="w-full flex items-center gap-4 text-left cursor-pointer transition-transform duration-150 active:scale-[0.98]"
      style={{
        padding: "22px 18px",
        background: `linear-gradient(135deg, rgb(var(${color}) / calc(0.10 * var(--tint))) 0%, rgb(var(--c-elevated)) 70%)`,
        border: `1px solid rgb(var(${color}) / calc(0.45 * var(--tint)))`,
        boxShadow: `0 4px 18px rgba(0,0,0,0.5), inset 0 0 18px rgb(var(${color}) / calc(0.05 * var(--tint)))`,
      }}
    >
      <span
        className="shrink-0 flex items-center justify-center"
        style={{ width: 48, height: 48, color: c, filter: `drop-shadow(0 0 6px rgb(var(${color}) / calc(0.6 * var(--tint))))` }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>{icon}</svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display leading-none" style={{ fontSize: 26, color: c, letterSpacing: "0.22em" }}>
          {label}
        </span>
        <span className="block font-mono mt-2" style={{ fontSize: 11, color: "rgb(var(--c-muted))", letterSpacing: "0.03em" }}>
          {blurb}
        </span>
      </span>
      {meta && (
        <span className="shrink-0 font-mono self-start" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.08em" }}>
          {meta}
        </span>
      )}
    </button>
  );
}
