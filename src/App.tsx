import React, { useState } from 'react';
import { useAuth, AuthProvider } from './AuthContext';
import { StoreProvider } from './context/StoreContext';
import { AmbientCanvas3D } from './components/AmbientCanvas3D';
import { BaselineDashboard } from './components/BaselineDashboard';
import { LogIn, Target, Sparkles, Activity, ShieldCheck, Dumbbell, Zap } from 'lucide-react';

function AppContent() {
  const { user, loading, signInWithGoogle, signInWithUsername } = useAuth();
  
  const [authError, setAuthError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleGoogleLogin = async () => {
    setAuthError('');
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setAuthError(error.message || 'Google sign-in could not be completed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      await signInWithUsername(usernameInput);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
          <Activity className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Loading Baseline Engine...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* 3D WebGL Ambient Decorative Layer */}
        <AmbientCanvas3D />

        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-2xl p-7 sm:p-8 rounded-3xl border border-slate-700/60 text-center space-y-6 shadow-2xl relative z-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-300 rounded-2xl mx-auto flex items-center justify-center shadow-[0_10px_25px_rgba(16,185,129,0.3)]">
            <Target className="w-8 h-8 text-slate-950" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold mb-2">
              <Zap className="w-3.5 h-3.5" />
              <span>Prompt 1 &bull; Baseline Scaffold</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              VibeDiet 3D Tracker
            </h1>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              3D-native diet & hydration tracker running on local mock state with deterministic Mifflin-St Jeor biometrics.
            </p>
          </div>

          <div className="space-y-4">
            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isAuthenticating}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-3 shadow-xl active:scale-[0.99] disabled:opacity-50 text-sm cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isAuthenticating ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-slate-900 px-3 text-slate-400 font-bold tracking-wider">or instant demo</span>
              </div>
            </div>

            {/* Username Login Form */}
            <form onSubmit={handleUsernameLogin} className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tracker Username
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. alex_fitness"
                  disabled={isAuthenticating}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition disabled:opacity-50 placeholder-slate-500"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-xs active:scale-[0.99] cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Enter Tracker</span>
              </button>
            </form>

            <button
              type="button"
              onClick={async () => {
                setAuthError('');
                try {
                  const demoId = `athlete_${Math.floor(1000 + Math.random() * 9000)}`;
                  await signInWithUsername(demoId);
                } catch (e: any) {
                  setAuthError(e.message);
                }
              }}
              disabled={isAuthenticating}
              className="w-full bg-slate-800/80 hover:bg-slate-800 hover:border-emerald-500/40 text-slate-200 font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-2 border border-slate-700/80 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant 1-Click Guest Demo</span>
            </button>

            {authError && (
              <div className="bg-red-500/15 border border-red-500/30 p-3 rounded-xl mt-4">
                <p className="text-red-400 text-xs text-center font-medium">{authError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] relative overflow-hidden">
      {/* 3D WebGL Ambient Decorative Layer (Background) */}
      <AmbientCanvas3D />

      {/* Main 5-Screen Baseline Dashboard Shell */}
      <BaselineDashboard />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </AuthProvider>
  );
}
