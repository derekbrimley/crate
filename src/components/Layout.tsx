import React from "react";
import { BottomNav } from "./BottomNav";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  headerRight?: React.ReactNode;
}

export function Layout({ children, title, headerRight }: LayoutProps) {
  return (
    <div className="min-h-screen bg-crate-bg flex flex-col">
      {title && (
        <header
          className="sticky top-0 z-40 border-b border-crate-border"
          style={{
            background: "rgba(9,7,10,0.97)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
            <h1
              className="font-display text-[22px] leading-none text-crate-text tracking-widest"
              style={{ letterSpacing: "0.18em" }}
            >
              {title.toUpperCase()}
            </h1>
            {headerRight}
          </div>
        </header>
      )}
      <main className="flex-1 max-w-xl mx-auto w-full pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
