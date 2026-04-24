import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { DataCacheProvider } from "./contexts/DataCache";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { Crates } from "./pages/Crates";
import { Lists } from "./pages/Lists";
import { AddAlbums } from "./pages/AddAlbums";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";

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
    return <Login onEmailLogin={loginWithEmail} onSignUp={signUpWithEmail} onForgotPassword={resetPasswordForEmail} />;
  }

  return (
    <DataCacheProvider>
      <Routes>
        <Route path="/" element={<Crates onLogout={logout} />} />
        <Route path="/library" element={<Lists onLogout={logout} />} />
        <Route path="/add" element={<AddAlbums />} />
        <Route path="/history" element={<History onLogout={logout} />} />
        <Route path="/settings" element={<Settings onLogout={logout} />} />
        <Route path="/callback" element={<Crates onLogout={logout} />} />
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
