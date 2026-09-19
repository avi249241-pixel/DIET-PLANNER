import React, { useState, useEffect } from 'react';
import { Key, CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink, X, Sparkles, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  removeStoredGeminiApiKey,
  validateGeminiApiKey,
} from '../lib/geminiClient';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredGeminiApiKey());
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      removeStoredGeminiApiKey();
      setStatusMessage({ type: 'success', text: 'API key cleared.' });
      if (onKeySaved) onKeySaved();
      setTimeout(onClose, 800);
      return;
    }

    setIsValidating(true);
    setStatusMessage(null);

    const validation = await validateGeminiApiKey(trimmed);
    setIsValidating(false);

    if (validation.valid) {
      setStoredGeminiApiKey(trimmed);
      setStatusMessage({ type: 'success', text: 'Gemini API key validated and saved successfully!' });
      if (onKeySaved) onKeySaved();
      setTimeout(onClose, 1000);
    } else {
      setStatusMessage({
        type: 'error',
        text: validation.error || 'Invalid API key. Please check your key in Google AI Studio.',
      });
    }
  };

  const handleClear = () => {
    removeStoredGeminiApiKey();
    setApiKey('');
    setStatusMessage({ type: 'success', text: 'API key removed.' });
    if (onKeySaved) onKeySaved();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-6 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Gemini AI Key</h3>
                <p className="text-xs text-slate-500 font-medium">Direct client-side AI analysis</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Explanation */}
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Run food photo recognition and macro estimation directly in your browser. Your key is stored securely in your device's local storage and never sent to any intermediary server.
          </p>

          {/* Key Input */}
          <div className="space-y-3 mb-4">
            <label className="block text-xs font-semibold text-slate-700">
              Google Gemini API Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* External link to Google AI Studio */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline pt-0.5"
            >
              Get a free API key from Google AI Studio
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl mb-4 text-xs font-medium flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </motion.div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {apiKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isValidating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {isValidating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Test & Save'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
