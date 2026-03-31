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
        <header className="sticky top-0 z-40 bg-crate-bg/95 backdrop-blur border-b border-crate-border">
          <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
            <h1 className="font-display text-xl font-semibold italic text-crate-text tracking-wide leading-none">
              {title}
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
