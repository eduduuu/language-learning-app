import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthModal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
  };

  return (
    <form onSubmit={handleAuth} className="p-6 bg-slate-800 rounded-xl max-w-sm mx-auto space-y-4">
      <h3 className="text-xl font-bold text-white">{isSignUp ? 'Create Account' : 'Sign In'}</h3>
      {error && <p className="text-rose-400 text-sm">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white"
        required
      />
      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-medium">
        {isSignUp ? 'Sign Up' : 'Sign In'}
      </button>
      <button
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="text-xs text-slate-400 underline w-full text-center"
      >
        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
      </button>
    </form>
  );
}