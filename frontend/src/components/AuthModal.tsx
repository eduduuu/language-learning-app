import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Input, Label, cx } from './ui';

interface AuthModalProps {
  onClose?: () => void;
  defaultMode?: 'signin' | 'signup';
}

export function AuthModal({ onClose, defaultMode = 'signin' }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === 'signup';

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        return;
      }

      if (isSignUp) {
        setNotice('Check your inbox to confirm your email, then sign in.');
      } else {
        onClose?.();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isSignUp ? 'signin' : 'signup');
    setError(null);
    setNotice(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-[420px] rounded-2xl border border-zinc-800/80 bg-zinc-900/95 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] animate-slide-up overflow-hidden">
        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        )}

        <div className="px-7 pt-8 pb-7">
          {/* Brand mark */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="grid place-items-center w-8 h-8 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/30 text-amber-400">
              <BookOpen size={15} strokeWidth={2.2} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Context Reader
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-display text-[28px] leading-tight text-zinc-50">
            {isSignUp ? 'Begin your library.' : 'Welcome back.'}
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            {isSignUp
              ? 'Create an account to save books, track progress, and sync across devices.'
              : 'Sign in to continue your reading practice.'}
          </p>

          {/* Alerts */}
          {error && (
            <div className="mt-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs animate-fade-in">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs animate-fade-in leading-relaxed">
              {notice}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    className="text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
                    onClick={() =>
                      setNotice('Password reset — coming soon.')
                    }
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'At least 6 characters' : '••••••••'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={cx(
                    'absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors',
                    'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60',
                  )}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} fullWidth size="lg">
              {!loading && (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-zinc-800/80" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
              or
            </span>
            <div className="flex-1 h-px bg-zinc-800/80" />
          </div>

          {/* Mode switch */}
          <button
            type="button"
            onClick={switchMode}
            className="w-full text-center text-[12.5px] text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <span className="text-amber-400 font-medium">Sign in</span>
              </>
            ) : (
              <>
                New here?{' '}
                <span className="text-amber-400 font-medium">
                  Create an account
                </span>
              </>
            )}
          </button>
        </div>

        {/* Fine print */}
        <div className="px-7 py-4 border-t border-zinc-800/70 bg-zinc-950/40">
          <p className="text-[10.5px] text-zinc-600 leading-relaxed text-center">
            By continuing you agree to our{' '}
            <a href="/terms" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
              Terms
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}