import React, { useState } from "react";
import type { Item } from "../../types";

export const SPINE_WIDTH = 46;
export const SPINE_HEIGHT = 170;
export const SPINE_HEIGHT_DESKTOP = 212;

interface SpineItemProps {
  item: Item;
  isSelected: boolean;
  onClick: () => void;
  overlap?: number;
  spineWidth?: number;
  spineHeight?: number;
  statLabel?: string;
  onFavorite?: (item: Item) => void;
}

export function getSpineColor(id: number): string {
  const hue = (id * 137) % 360;
  const sat = 30 + ((id * 47) % 30);
  const lit = 20 + ((id * 23) % 15);
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

export function SpineItem({ item, isSelected, onClick, overlap = 0, spineWidth = SPINE_WIDTH, spineHeight = SPINE_HEIGHT, statLabel, onFavorite }: SpineItemProps) {
  const [hovered, setHovered] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const color = getSpineColor(item.id);

  const isWide = spineWidth >= 90;
  const expanded = !isWide && hovered && !isSelected;
  const expandedWidth = Math.min(spineHeight, Math.max(spineWidth * 2.5, 120));
  const currentWidth = expanded ? expandedWidth : spineWidth;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${item.title} — ${item.creator}`}
      className="shrink-0 cursor-pointer relative overflow-hidden"
      style={{
        width: currentWidth,
        height: spineHeight,
        marginLeft: overlap ? -overlap : undefined,
        transition: "width 0.2s cubic-bezier(0.25,0.85,0.25,1), transform 0.2s cubic-bezier(0.15,0.85,0.25,1), box-shadow 0.2s ease",
        transform: isSelected
          ? "translateY(-24px)"
          : hovered
            ? "translateY(-7px)"
            : "translateY(0)",
        boxShadow: isSelected
          ? "0 0 0 1.5px #ff5e00, 4px 0 16px rgba(0,0,0,0.9), 0 0 12px rgba(255,94,0,0.25)"
          : hovered
            ? "3px 0 12px rgba(0,0,0,0.7), -2px 0 8px rgba(0,0,0,0.5)"
            : "-4px 0 4px rgba(0,0,0,0.5)",
        zIndex: isSelected ? 10 : hovered ? 20 : 1,
      }}
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            objectFit: "cover",
            filter: isSelected ? "brightness(1.1)" : hovered ? "brightness(1)" : isWide ? "brightness(0.9)" : "brightness(0.75)",
          }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0.6) 100%)`,
          }}
        />
      )}

      {!isWide && !expanded && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)",
          }}
        />
      )}

      {isSelected && (
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: 2, background: "#ff5e00", boxShadow: "0 0 8px #ff5e00", zIndex: 2 }}
        />
      )}

      {onFavorite && !favorited && hovered && !isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (favoriting) return;
            setFavoriting(true);
            onFavorite(item);
            setFavorited(true);
          }}
          className="absolute flex items-center justify-center cursor-pointer"
          style={{
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,94,0,0.6)",
            color: "#ff5e00",
            fontSize: 11,
            zIndex: 30,
            lineHeight: 1,
          }}
          title="Add to favorites"
        >
          ★
        </button>
      )}

      {onFavorite && favorited && (
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,94,0,0.6)",
            color: "#ff5e00",
            fontSize: 11,
            zIndex: 30,
          }}
        >
          ★
        </div>
      )}

      {isWide ? (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            padding: "24px 6px 5px",
            background: "linear-gradient(transparent, rgba(0,0,0,0.88))",
            zIndex: 1,
          }}
        >
          <div
            className="truncate font-mono"
            style={{
              fontSize: 12,
              color: isSelected ? "#ff5e00" : "rgb(68, 253, 33)",
              letterSpacing: "0.04em",
              textShadow: isSelected ? "0 0 8px rgba(255,94,0,0.9)" : "0 0 8px rgba(68,253,33,0.6), 0 1px 2px rgba(0,0,0,0.9)",
              fontWeight: 700,
            }}
          >
            {item.title}
          </div>
          <div
            className="truncate font-mono"
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.04em",
            }}
          >
            {item.creator}
          </div>
          {statLabel && (
            <div
              className="font-mono"
              style={{ fontSize: 11, color: "#ff5e00", letterSpacing: "0.04em", marginTop: 1 }}
            >
              {statLabel}
            </div>
          )}
        </div>
      ) : !expanded ? (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              zIndex: 1,
              top: "50%",
              left: "50%",
              width: spineHeight,
              transform: "translate(-50%, -50%) rotate(-90deg)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
              paddingLeft: 6,
              paddingRight: 6,
              fontSize: 11,
              fontFamily: '"IBM Plex Mono", monospace',
              color: isSelected ? "#ff5e00" : "rgb(68, 253, 33)",
              letterSpacing: "0.05em",
              textShadow: isSelected
                ? "0 0 8px rgba(255,94,0,0.9)"
                : "0 0 8px rgba(68,253,33,0.7), 0 0 16px rgba(68,253,33,0.3), 0 1px 3px rgba(0,0,0,1)",
              fontWeight: 700,
              WebkitTextStroke: "0.3px rgba(0,0,0,0.4)",
            }}
          >
            {item.title}
          </div>
          {statLabel && (
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none text-center"
              style={{
                padding: "10px 2px 4px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                zIndex: 1,
              }}
            >
              <div
                className="font-mono truncate"
                style={{ fontSize: 11, color: "#ff5e00", letterSpacing: "0.02em" }}
              >
                {statLabel}
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            padding: "20px 5px 5px",
            background: "linear-gradient(transparent, rgba(0,0,0,0.88))",
            zIndex: 1,
          }}
        >
          <div
            className="truncate"
            style={{
              fontSize: 12,
              fontFamily: '"IBM Plex Mono", monospace',
              color: "rgb(68, 253, 33)",
              letterSpacing: "0.04em",
              textShadow: "0 0 8px rgba(68,253,33,0.6), 0 1px 2px rgba(0,0,0,0.9)",
              fontWeight: 700,
            }}
          >
            {item.title}
          </div>
          <div
            className="truncate"
            style={{
              fontSize: 11,
              fontFamily: '"IBM Plex Mono", monospace',
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.04em",
            }}
          >
            {item.creator}
          </div>
        </div>
      )}
    </div>
  );
}
