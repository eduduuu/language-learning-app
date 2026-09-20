import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, CheckCircle2, Layers } from 'lucide-react';
import { api } from '../lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Label,
  LoadingState,
  PageHeader,
} from '../components/ui';
import { CardManagerModal } from '../components/srs/CardManagerModal';

interface UserSettings {
  id: string;
  tier: string;
  max_new_cards_per_day: number;
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [maxNewCards, setMaxNewCards] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCardManager, setShowCardManager] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<UserSettings>('/settings');
        setSettings(res.data);
        setMaxNewCards(res.data.max_new_cards_per_day);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.patch<UserSettings>('/settings', {
        max_new_cards_per_day: maxNewCards,
      });
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch {
      alert('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading preferences…" />;

  return (
    <div className="space-y-10 max-w-2xl">
      <PageHeader
        icon={SettingsIcon}
        kicker="Account"
        title="Preferences"
        subtitle="Tune your daily learning volume, manage decks, and review account details."
      />

      <Card>
        <CardHeader
          title="Daily study limits"
          subtitle="Control how many new cards enter your rotation each day"
          icon={SettingsIcon}
          action={
            <Badge variant="gold">{settings?.tier ?? 'free'}</Badge>
          }
        />

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <Label hint="1 – 100">Max new cards per day</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={maxNewCards}
              onChange={(e) => setMaxNewCards(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Higher values accelerate vocabulary acquisition but increase review load.
              We recommend 15–25 for sustainable progress.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="h-5">
              {saved && (
                <span className="inline-flex items-center gap-2 text-xs text-emerald-400 animate-fade-in">
                  <CheckCircle2 size={14} />
                  Saved
                </span>
              )}
            </div>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Decks & SRS vocabulary"
          subtitle="Manage your cards, reschedule repetitions, or import/export with Anki"
          icon={Layers}
        />
        <div className="p-6 space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            View all vocabulary cards created across your books and JLPT study. Reschedule reviews, reset cards to new, mark words as mastered, or export complete decks to Anki.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              onClick={() => setShowCardManager(true)}
              size="sm"
            >
              <Layers size={14} />
              Manage cards & decks
            </Button>
          </div>
        </div>
      </Card>

      <CardManagerModal
        isOpen={showCardManager}
        onClose={() => setShowCardManager(false)}
      />
    </div>
  );
};