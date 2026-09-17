import React from 'react';
import { useStore } from '../../context/StoreContext';
import { AlertCircle, X, Sparkles, ShieldAlert } from 'lucide-react';

export function UnimplementedModal() {
  const { unimplementedFeature, setUnimplementedFeature } = useStore();

  if (!unimplementedFeature) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        <button
          type="button"
          onClick={() => setUnimplementedFeature(null)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Prompt 2 Roadmap
          </span>
          <h2 className="text-xl font-bold text-white mt-2 tracking-tight">
            {unimplementedFeature}
          </h2>
          <p className="text-slate-300 text-xs mt-2 leading-relaxed">
            This module is intentionally decoupled in <strong>Prompt 1</strong> to establish an ironclad, zero-network baseline UI.
            Its backend models, external nutrition databases, and Atwater verification engine are wired in <strong>Prompt 2</strong>.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl text-[11px] text-slate-400 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            The 5 core baseline screens (Profile Setup, Quick Log, Daily Log, Diet Plan, Hydration) are fully functional on local mock state.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setUnimplementedFeature(null)}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
        >
          Understood & Return
        </button>
      </div>
    </div>
  );
}
