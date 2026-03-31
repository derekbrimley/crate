import React from "react";

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
  const sizeClasses = {
    sm: "w-28",
    md: "w-36",
    lg: "w-44",
  };

  const imgSizeClasses = {
    sm: "h-28 w-28",
    md: "h-36 w-36",
    lg: "h-44 w-44",
  };

  const handleClick = () => {
    onPick?.();
    if (externalUri) {
      window.location.href = externalUri;
    } else if (externalUrl) {
      window.open(externalUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${sizeClasses[size]} shrink-0`}>
      <button
        onClick={handleClick}
        className="relative group cursor-pointer"
        title={`Listen to ${title} by ${artist} on Spotify`}
      >
        <div
          className={`${imgSizeClasses[size]} rounded-md overflow-hidden bg-crate-elevated shadow-[0_4px_20px_rgba(0,0,0,0.55)] group-hover:shadow-[0_14px_36px_rgba(0,0,0,0.75)] group-hover:-translate-y-[5px] transition-all duration-300 ease-out group-active:scale-95 group-active:translate-y-0 group-active:shadow-[0_2px_10px_rgba(0,0,0,0.4)]`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${title} by ${artist}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-crate-elevated">
              <span className="text-3xl opacity-20">♪</span>
            </div>
          )}
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
          <div className="bg-black/75 backdrop-blur-sm rounded-full p-1.5 shadow-md">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>
        </div>
      </button>
      <div className="px-0.5">
        <p className="text-[13px] font-medium text-crate-text truncate leading-snug" title={title}>
          {title}
        </p>
        <p className="text-[11px] text-crate-muted truncate leading-snug mt-0.5 font-light" title={artist}>
          {artist}
        </p>
      </div>
      {actions && <div className="px-0.5">{actions}</div>}
    </div>
  );
}
