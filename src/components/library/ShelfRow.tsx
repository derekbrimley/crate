import React, { useRef, useState, useLayoutEffect } from "react";
import { SpineItem, SPINE_WIDTH, SPINE_HEIGHT, SPINE_HEIGHT_DESKTOP } from "./SpineItem";
import type { Item } from "../../types";

interface ShelfRowProps {
  items: Item[];
  spinesPerRow: number;
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number | null) => void;
  detailPanel?: React.ReactNode;
  overlap?: number;
  spineWidth?: number;
  statLabels?: Map<number, string>;
  centerItems?: boolean;
  autoFit?: boolean;
  onFavorite?: (item: Item) => void;
}

export function ShelfRow({
  items,
  spinesPerRow,
  selectedAlbumId,
  onSelectAlbum,
  detailPanel,
  overlap = 0,
  spineWidth,
  statLabels,
  centerItems,
  autoFit,
  onFavorite,
}: ShelfRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!autoFit || !containerRef.current) return;
    const measure = () => {
      const w = containerRef.current?.clientWidth;
      if (w) setMeasuredWidth(w);
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [autoFit]);

  let effectiveWidth = spineWidth || SPINE_WIDTH;
  if (autoFit && measuredWidth && items.length > 0) {
    const padding = 16;
    effectiveWidth = Math.floor((measuredWidth - padding) / items.length);
  }

  const effectiveHeight = measuredWidth && measuredWidth >= 600 ? SPINE_HEIGHT_DESKTOP : SPINE_HEIGHT;

  const fillerCount = centerItems ? 0 : Math.max(0, spinesPerRow - items.length);

  return (
    <>
      <div
        style={{
          height: 7,
          margin: "0 12px",
          background: "linear-gradient(180deg, #5a3818 0%, #3a2008 100%)",
          border: "1px solid #4a2e10",
          boxShadow: "0 -2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      />

      <div
        ref={containerRef}
        style={{
          margin: "0 12px",
          background: "linear-gradient(180deg, #0e0609 0%, #090408 100%)",
          borderLeft: "3px solid #261408",
          borderRight: "3px solid #261408",
          paddingTop: 14,
          overflowX: "hidden",
          overflowY: "visible",
        }}
      >
        <div
          className={`flex items-end ${centerItems ? "justify-center" : ""}`}
          style={{ padding: "0 8px" }}
        >
          {items.map((item, i) => (
            <SpineItem
              key={item.id}
              item={item}
              isSelected={selectedAlbumId === item.id}
              onClick={() => onSelectAlbum(selectedAlbumId === item.id ? null : item.id)}
              overlap={i === 0 ? 0 : overlap}
              spineWidth={effectiveWidth}
              spineHeight={effectiveHeight}
              statLabel={statLabels?.get(item.id)}
              onFavorite={onFavorite}
            />
          ))}
          {Array.from({ length: fillerCount }).map((_, i) => (
            <div
              key={`fill-${i}`}
              className="shrink-0"
              style={{
                width: effectiveWidth,
                height: effectiveHeight,
                marginLeft: (i === 0 && items.length > 0) || i > 0 ? -overlap : undefined,
                opacity: 0.06,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
                borderLeft: "1px solid rgba(255,255,255,0.04)",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          height: 8,
          margin: "0 12px",
          background: "linear-gradient(180deg, #221008 0%, #160c04 100%)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
        }}
      />

      {detailPanel && (
        <div style={{ margin: "0 12px" }}>
          {detailPanel}
        </div>
      )}
    </>
  );
}
