import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LegalModal } from './LegalModal';

interface AuthModalProps {
  onClose?: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  // Close on Escape if onClose is provided
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !legalModalType) onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, legalModalType]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('not enabled') || msg.includes('Unsupported provider') || (error as any)?.code === 400) {
          setError(
            'Google Sign-In is not enabled yet in your Supabase dashboard. Please go to Authentication → Providers → Google and enable it with your Google Cloud Client ID & Secret.'
          );
        } else {
          setError(error.message);
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('not enabled') || msg.includes('Unsupported provider')) {
        setError(
          'Google Sign-In is not enabled yet in your Supabase dashboard. Please go to Authentication → Providers → Google and enable it.'
        );
      } else {
        setError(err?.message ?? 'Google authentication failed.');
      }
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-zinc-950/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Card */}
        <div className="relative w-full max-w-[420px] rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] animate-slide-up overflow-hidden">
          {/* Top subtle glow */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}

          <div className="px-7 pt-9 pb-8 text-center">
            {/* Brand icon */}
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-400/10 ring-1 ring-amber-400/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-400/5 mb-5">
              <BookOpen size={22} strokeWidth={2.2} />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[11px] font-medium text-amber-300 mb-3">
              <Sparkles size={11} />
              Local-First Japanese Immersion
            </div>

            <h2 className="font-display text-2xl text-zinc-50 tracking-tight">
              Start Reading Japanese in Context
            </h2>

            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed max-w-xs mx-auto">
              Read authentic EPUB books with 0ms offline lookups, automated tokenization, and FSRS spaced repetition flashcards.
            </p>

            {/* Error banner */}
            {error && (
              <div className="mt-5 text-left flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs animate-fade-in">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Google Sign-In Action */}
            <div className="mt-7 space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-xl border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-100 font-medium text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"
                  />
                </svg>
                {oauthLoading ? 'Connecting to Google…' : 'Continue with Google'}
              </button>

              <p className="text-[11px] text-zinc-500">
                Fast & secure • No passwords to remember
              </p>
            </div>
          </div>

          {/* Footer Terms */}
          <div className="px-7 py-3.5 border-t border-zinc-800/80 bg-zinc-950/60">
            <p className="text-[10.5px] text-zinc-500 leading-relaxed text-center">
              By continuing you agree to our{' '}
              <button
                type="button"
                onClick={() => setLegalModalType('terms')}
                className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setLegalModalType('privacy')}
                className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </div>
      </div>

      {legalModalType && (
        <LegalModal
          type={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
      )}
    </>
  );
}