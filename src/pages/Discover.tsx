import React, { useCallback, useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { PageHeader, HeaderAction } from "../components/PageHeader";
import { VinylDisc } from "../components/VinylDisc";
import { CoverGrid, GridHeading } from "../components/CoverGrid";
import { ItemSheet } from "../components/ItemSheet";
import { useLibraryData } from "../hooks/useLibraryData";
import { useRankedPool } from "../hooks/useRankedPool";
import { DISCOVER_WEIGHTING } from "../../lib/ranking";
import { getPendingRecommendations, actOnRecommendation } from "../services/api";
import type { FriendRecommendation, Item } from "../types";

interface DiscoverProps {
  onLogout: () => void;
}

/**
 * A friend's recommendation shaped as an Item for the grid and details pane.
 * The _friend_rec metadata makes the pane offer add / dismiss instead of the
 * library actions.
 */
function friendRecToItem(rec: FriendRecommendation): Item {
  return {
    id: rec.id,
    user_id: rec.recipient_id,
    media_type: "album",
    list_type: "recommendation",
    title: rec.title,
    creator: rec.creator,
    image_url: rec.image_url,
    external_id: rec.external_id,
    external_uri: rec.external_uri,
    external_url: rec.external_url,
    added_at: rec.sent_at,
    metadata: { _friend_rec: true, _rec_id: rec.id, _sender_name: rec.sender_display_name },
  };
}

/** Recommendations, weighted hard toward what you haven't heard; friend recs on top. */
export function Discover({ onLogout }: DiscoverProps) {
  const { recommendations, ready, loadLists } = useLibraryData();
  const [selected, setSelected] = useState<{ item: Item; fromFriend: boolean } | null>(null);
  const [friendRecs, setFriendRecs] = useState<Item[]>([]);

  const loadFriendRecs = useCallback(() => {
    getPendingRecommendations(20)
      .then(({ recommendations: recs }) => setFriendRecs(recs.map(friendRecToItem)))
      .catch(() => {});
  }, []);

  useEffect(() => { loadFriendRecs(); }, [loadFriendRecs]);

  const { ranked, resting, reshuffle } = useRankedPool("discover", ready ? recommendations : null, DISCOVER_WEIGHTING);

  // Accepting files the album under favorites server-side, so the lists reload.
  const handleAccept = async (item: Item) => {
    try {
      await actOnRecommendation(item.id, "accept");
      setFriendRecs((prev) => prev.filter((i) => i.id !== item.id));
      setSelected(null);
      loadLists();
    } catch (err) {
      console.error("Failed to accept recommendation:", err);
    }
  };

  const handleDismiss = async (item: Item) => {
    try {
      await actOnRecommendation(item.id, "dismiss");
      setFriendRecs((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error("Failed to dismiss recommendation:", err);
    }
  };

  const senderCaption = (item: Item) => {
    const meta = item.metadata as Record<string, unknown> | null;
    const name = meta?._sender_name as string | null | undefined;
    return name ? `from ${name}` : "from a friend";
  };

  return (
    <Layout>
      <PageHeader
        title="Discover"
        backTo="/"
        onLogout={onLogout}
        actions={
          <HeaderAction onClick={reshuffle} title="Reshuffle" disabled={!ready}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </HeaderAction>
        }
      />

      <div style={{ paddingBottom: 100 }}>
        {friendRecs.length > 0 && (
          <>
            <GridHeading label="FROM FRIENDS" count={friendRecs.length} />
            <CoverGrid items={friendRecs} onSelect={(item) => setSelected({ item, fromFriend: true })} caption={senderCaption} />
          </>
        )}

        {!ready ? (
          <div className="mt-16 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
          </div>
        ) : ranked.length + resting.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3">
            <VinylDisc size={56} />
            <p className="font-mono text-xs text-crate-muted text-center" style={{ letterSpacing: "0.1em" }}>
              NO RECOMMENDATIONS YET — ADD SOME WITH ◈ REC
            </p>
          </div>
        ) : (
          <>
            {ranked.length > 0 && (
              <>
                <GridHeading label="UP NEXT" count={ranked.length} />
                <CoverGrid items={ranked} onSelect={(item) => setSelected({ item, fromFriend: false })} />
              </>
            )}
            {resting.length > 0 && (
              <>
                <GridHeading label="RECENTLY PLAYED" count={resting.length} />
                <CoverGrid items={resting} onSelect={(item) => setSelected({ item, fromFriend: false })} dimmed />
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        selected.fromFriend ? (
          <ItemSheet
            item={selected.item}
            playSource="discover"
            onClose={() => setSelected(null)}
            onPromote={handleAccept}
            onRemove={handleDismiss}
            hideStats
          />
        ) : (
          <ItemSheet item={selected.item} playSource="discover" onClose={() => setSelected(null)} />
        )
      )}
    </Layout>
  );
}
