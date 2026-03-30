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
    <Layout title="My Lists">
      {/* Tab switcher */}
      <div className="sticky top-14 z-30 bg-crate-bg border-b border-crate-border px-4 flex gap-4">
        <button
          onClick={() => setTab("favorites")}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "favorites"
              ? "border-crate-accent text-crate-text"
              : "border-transparent text-crate-muted hover:text-crate-text"
          }`}
        >
          Favorites
          {favorites.length > 0 && (
            <span className="ml-1.5 text-xs bg-crate-elevated px-1.5 py-0.5 rounded-full">
              {favorites.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("recommendations")}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "recommendations"
              ? "border-crate-accent text-crate-text"
              : "border-transparent text-crate-muted hover:text-crate-text"
          }`}
        >
          Recommendations
          {recommendations.length > 0 && (
            <span className="ml-1.5 text-xs bg-crate-elevated px-1.5 py-0.5 rounded-full">
              {recommendations.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-crate-elevated animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-4xl mb-4">{tab === "favorites" ? "⭐" : "📋"}</p>
            <p className="text-crate-muted text-sm">
              {tab === "favorites"
                ? "No favorites yet — add some albums"
                : "No recommendations yet — add some albums to try"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 p-3 bg-crate-elevated rounded-xl"
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-crate-border flex items-center justify-center shrink-0">
                    <span className="text-2xl">🎵</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-crate-text truncate">{item.title}</p>
                  <p className="text-xs text-crate-muted truncate">{item.creator}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {tab === "recommendations" && (
                    <button
                      onClick={() => handlePromote(item)}
                      disabled={actionId === item.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-accent text-black font-semibold hover:bg-crate-accent-dim disabled:opacity-50 transition-colors"
                      title="Promote to Favorites"
                    >
                      {actionId === item.id ? "..." : "⭐"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={actionId === item.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-surface border border-crate-border text-crate-muted hover:text-red-400 disabled:opacity-50 transition-colors"
                    title="Remove"
                  >
                    {actionId === item.id ? "..." : "✕"}
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
