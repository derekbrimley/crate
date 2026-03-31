import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { getAlbums, deleteAlbum, promoteAlbum } from "../services/api";
import type { Item } from "../types";

type Tab = "favorites" | "recommendations";

export function Lists() {
  const [tab, setTab] = useState<Tab>("favorites");
  const [favorites, setFavorites] = useState<Item[]>([]);
  const [recommendations, setRecommendations] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [favRes, recRes] = await Promise.all([
        getAlbums("favorite"),
        getAlbums("recommendation"),
      ]);
      setFavorites(favRes.items);
      setRecommendations(recRes.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleDelete = async (item: Item) => {
    setActionId(item.id);
    try {
      await deleteAlbum(item.id);
      if (item.list_type === "favorite") {
        setFavorites((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
      }
    } finally {
      setActionId(null);
    }
  };

  const handlePromote = async (item: Item) => {
    setActionId(item.id);
    try {
      await promoteAlbum(item.id);
      setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
      setFavorites((prev) => [{ ...item, list_type: "favorite" }, ...prev]);
    } finally {
      setActionId(null);
    }
  };

  const items = tab === "favorites" ? favorites : recommendations;

  return (
    <Layout title="My Library">
      {/* Tab switcher */}
      <div className="sticky top-14 z-30 bg-crate-bg/95 backdrop-blur border-b border-crate-border px-5 flex gap-5">
        {(["favorites", "recommendations"] as Tab[]).map((t) => {
          const isActive = tab === t;
          const count = t === "favorites" ? favorites.length : recommendations.length;
          const label = t === "favorites" ? "Favorites" : "Recs";
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium border-b-2 transition-all duration-150 flex items-center gap-2 ${
                isActive
                  ? "border-crate-accent text-crate-text"
                  : "border-transparent text-crate-muted hover:text-crate-text"
              }`}
            >
              <span className={isActive ? "font-display italic text-base leading-none" : ""}>{label}</span>
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                  isActive ? "bg-crate-accent/15 text-crate-accent" : "bg-crate-elevated text-crate-muted"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-14 h-14 rounded-md bg-crate-elevated animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded bg-crate-elevated animate-pulse w-40" />
                  <div className="h-2.5 rounded bg-crate-elevated animate-pulse w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-display text-5xl italic text-crate-muted/30 mb-4">
              {tab === "favorites" ? "empty" : "empty"}
            </p>
            <p className="text-crate-muted text-sm font-light">
              {tab === "favorites"
                ? "No favorites yet — add some albums"
                : "No recommendations yet — add some albums to try"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-crate-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3.5 py-3"
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-[52px] h-[52px] rounded-md object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                  />
                ) : (
                  <div className="w-[52px] h-[52px] rounded-md bg-crate-elevated flex items-center justify-center shrink-0">
                    <span className="text-xl opacity-20">♪</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-crate-text truncate">{item.title}</p>
                  <p className="text-xs text-crate-muted truncate mt-0.5 font-light">{item.creator}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {tab === "recommendations" && (
                    <button
                      onClick={() => handlePromote(item)}
                      disabled={actionId === item.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-accent text-black font-semibold hover:bg-crate-accent-dim disabled:opacity-50 transition-colors"
                      title="Promote to Favorites"
                    >
                      {actionId === item.id ? "…" : "⭐"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={actionId === item.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-elevated border border-crate-border text-crate-muted hover:text-red-400 hover:border-red-900/40 disabled:opacity-50 transition-all duration-150"
                    title="Remove"
                  >
                    {actionId === item.id ? "…" : "✕"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
