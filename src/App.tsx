import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { DataCacheProvider } from "./contexts/DataCache";
import { PlayerProvider } from "./hooks/usePlayer";
import { PlayerBar } from "./components/PlayerBar";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { Home } from "./pages/Home";
import { CratesIndex } from "./pages/CratesIndex";
import { CratePage } from "./pages/CratePage";
import { Discover } from "./pages/Discover";
import { Lists } from "./pages/Lists";
import { AddAlbums } from "./pages/AddAlbums";
import { Search } from "./pages/Search";
import { History } from "./pages/History";

function AppInner() {
  const { user, loading, login, loginWithEmail, signUpWithEmail, logout, needsPasswordReset, resetPasswordForEmail, updatePassword, clearPasswordReset } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-crate-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (needsPasswordReset && user) {
    return <ResetPassword onUpdatePassword={updatePassword} onCancel={clearPasswordReset} />;
  }

  if (!user) {
    return <Login onEmailLogin={loginWithEmail} onSignUp={signUpWithEmail} onForgotPassword={resetPasswordForEmail} onSpotifyLogin={login} />;
  }

  return (
    <PlayerProvider>
      <DataCacheProvider>
        <Routes>
          <Route path="/" element={<Home onLogout={logout} />} />
          <Route path="/crates" element={<CratesIndex onLogout={logout} />} />
          <Route path="/crates/:id" element={<CratePage onLogout={logout} />} />
          <Route path="/discover" element={<Discover onLogout={logout} />} />
          <Route path="/library" element={<Lists onLogout={logout} />} />
          <Route path="/search" element={<Search onLogout={logout} />} />
          <Route path="/import" element={<AddAlbums onLogout={logout} />} />
          {/* The old Add page: its search moved to /search, its imports to /import. */}
          <Route path="/add" element={<Navigate to="/search" replace />} />
          <Route path="/history" element={<History onLogout={logout} />} />
          <Route path="/callback" element={<Home onLogout={logout} />} />
        </Routes>
        {/* Inside the cache provider: the player bar's album details pane edits
            the library, and the cached lists have to follow. */}
        <PlayerBar />
      </DataCacheProvider>
    </PlayerProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
