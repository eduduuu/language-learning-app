import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface UserSettings {
  id: string;
  tier: string;
  max_new_cards_per_day: number;
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [maxNewCards, setMaxNewCards] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get<UserSettings>('/settings');
      setSettings(res.data);
      setMaxNewCards(res.data.max_new_cards_per_day);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const res = await api.patch<UserSettings>('/settings', {
        max_new_cards_per_day: maxNewCards,
      });
      setSettings(res.data);
      setSuccess(true);
    } catch (err) {
      alert('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400">
        <Loader2 size={36} className="animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Loading user preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
          <SettingsIcon className="text-indigo-400" size={28} />
          User Preferences
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Configure daily learning volume limits and view account details.
        </p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm">
            <CheckCircle2 size={18} />
            <span>Settings updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Account Subscription Tier
            </label>
            <div className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs uppercase font-bold rounded">
              {settings?.tier || 'free'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Max New Cards Per Day
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxNewCards}
              onChange={(e) => setMaxNewCards(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Limits the maximum number of new vocabulary cards introduced daily in review sessions.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};