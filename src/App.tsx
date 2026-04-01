import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { DataCacheProvider } from "./contexts/DataCache";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { AddAlbums } from "./pages/AddAlbums";
import { Lists } from "./pages/Lists";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";

function AppInner() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-crate-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <DataCacheProvider>
      <Routes>
        <Route path="/" element={<Dashboard onLogout={logout} />} />
        <Route path="/add" element={<AddAlbums />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/callback" element={<Dashboard onLogout={logout} />} />
      </Routes>
    </DataCacheProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
