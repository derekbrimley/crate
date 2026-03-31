import React from "react";

interface LoginProps {
  onLogin: () => void;
  error?: string | null;
}

export function Login({ onLogin, error }: LoginProps) {
  return (
    <div className="min-h-screen bg-crate-bg flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-[280px]">
        {/* Wordmark */}
        <div className="text-center mb-12">
          <h1 className="font-display text-[92px] font-semibold text-crate-text tracking-tight leading-none mb-5">
            crate
          </h1>
          <div className="flex items-center gap-3 justify-center mb-5">
            <div className="flex-1 h-px bg-crate-border" />
            <span className="text-[10px] tracking-[0.22em] uppercase text-crate-muted font-medium">
              Intentional album picking
            </span>
            <div className="flex-1 h-px bg-crate-border" />
          </div>
        </div>

        {/* Features */}
        <div className="mb-12 space-y-4">
          {[
            { icon: "🎲", label: "Revisit recent favorites" },
            { icon: "🔮", label: "Rediscover deep cuts" },
            { icon: "📍", label: "Find the right vibe" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3.5">
              <span className="w-5 text-center text-base leading-none">{icon}</span>
              <span className="text-sm text-crate-muted font-light">{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-900/15 border border-red-900/30 rounded-lg text-sm text-red-400 font-light">
            Authentication failed. Please try again.
          </div>
        )}

        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#1DB954] hover:bg-[#1ed760] active:bg-[#158a3e] text-black font-semibold py-4 px-6 rounded-xl transition-all duration-150 active:scale-[0.98] tracking-wide"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Connect with Spotify
        </button>

        <p className="mt-5 text-center text-xs text-crate-muted font-light leading-relaxed">
          We only read your library data.
          <br />We don't modify anything.
        </p>
      </div>
    </div>
  );
}
