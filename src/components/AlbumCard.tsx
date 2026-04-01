import React, { useState, useRef, useEffect } from "react";
import { VinylDisc } from "./VinylDisc";

interface AlbumCardProps {
  title: string;
  artist: string;
  imageUrl: string | null;
  externalUri: string | null;
  externalUrl: string | null;
  onPick?: () => void;
  size?: "sm" | "md" | "lg";
  actions?: React.ReactNode;
}

const SIZES = { sm: 112, md: 144, lg: 176 };

export function AlbumCard({
  title,
  artist,
  imageUrl,
  externalUri,
  externalUrl,
  onPick,
  size = "md",
  actions,
}: AlbumCardProps) {
  const [picked, setPicked] = useState(false);
  const vinylRef = useRef<HTMLDivElement>(null);
  const px = SIZES[size];

  // Vinyl reveal — imperative to avoid Tailwind group issues
  useEffect(() => {
    const el = vinylRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const show = () => {
      el.style.opacity = "1";
      el.style.transform = "translateX(0)";
    };
    const hide = () => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-10px)";
    };
    parent.addEventListener("mouseenter", show);
    parent.addEventListener("mouseleave", hide);
    return () => {
      parent.removeEventListener("mouseenter", show);
      parent.removeEventListener("mouseleave", hide);
    };
  }, []);

  const handleClick = () => {
    onPick?.();
    setPicked(true);
    setTimeout(() => setPicked(false), 1200);
  };

  return (
    <div className="relative shrink-0 group" style={{ width: px }} onClick={handleClick}>
      {/* Vinyl disc sticking out from right edge on hover */}
      <div
        ref={vinylRef}
        className="absolute top-[10%] -right-4 z-0 pointer-events-none"
        style={{
          opacity: 0,
          transform: "translateX(-10px)",
          transition: "opacity 0.22s ease 0.06s, transform 0.22s ease 0.06s",
        }}
      >
        <VinylDisc size={Math.round(px * 0.8)} isSpinning={picked} />
      </div>

      {/* Record sleeve */}
      <div
        className="record-sleeve relative z-10"
        style={{ boxShadow: "3px 5px 14px rgba(0,0,0,0.7), 1px 2px 4px rgba(0,0,0,0.5)" }}
      >
        {/* Album art */}
        <div
          className="relative overflow-hidden bg-crate-elevated"
          style={{ width: px, height: px }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${title} by ${artist}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <VinylDisc size={Math.round(px * 0.7)} isSpinning={picked} />
            </div>
          )}
          {/* Cardboard edge */}
          <div className="absolute inset-0 ring-1 ring-inset ring-black/50 pointer-events-none" />
          {/* Spotify badge */}
          <div
            className="absolute bottom-1.5 right-1.5 transition-opacity duration-200"
            style={{ opacity: 0 }}
            ref={(el) => {
              if (!el) return;
              const card = el.closest(".group");
              if (!card) return;
              card.addEventListener("mouseenter", () => { el.style.opacity = "1"; });
              card.addEventListener("mouseleave", () => { el.style.opacity = "0"; });
            }}
          >
            <div className="w-5 h-5 rounded-full bg-black/80 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Label strip */}
        <div
          className="bg-crate-elevated px-2 pt-1.5 pb-1.5"
          style={{ borderTop: "1px solid rgba(0,0,0,0.6)" }}
        >
          <p className="text-[10px] font-mono font-medium text-crate-text truncate leading-snug tracking-tight" title={title}>
            {title}
          </p>
          <p className="text-[9px] font-mono text-crate-muted truncate mt-0.5 leading-snug" title={artist}>
            {artist}
          </p>
        </div>
      </div>

      {actions && <div className="mt-2 px-0.5">{actions}</div>}
    </div>
  );
}
