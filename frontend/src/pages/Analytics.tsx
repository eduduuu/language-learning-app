import React, { useEffect, useState } from 'react';
import { BarChart3, Book, Brain, Clock, Target } from 'lucide-react';
import { api } from '../lib/api';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '../components/ui';

interface AnalyticsOverview {
  total_books: number;
  total_cards: number;
  cards_due_today: number;
  quiz_total_attempts: number;
  quiz_accuracy_rate: number;
  grammar_theme_breakdown: Record<
    string,
    { total: number; correct: number; accuracy: number }
  >;
}

const Kpi: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub: string;
  accent?: 'zinc' | 'amber' | 'emerald';
}> = ({ icon: Icon, label, value, sub, accent = 'zinc' }) => {
  const accentClass = {
    zinc: 'text-zinc-500',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
  }[accent];

  return (
    <Card className="p-5 group transition-colors hover:border-zinc-700">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </span>
        <Icon size={15} className={accentClass} strokeWidth={2} />
      </div>
      <div className="font-display text-[2.5rem] leading-none text-zinc-50 tabular-nums">
        {value}
      </div>
      <p className="text-xs text-zinc-500 mt-2">{sub}</p>
    </Card>
  );
};

const accuracyColor = (a: number) =>
  a >= 80 ? 'text-emerald-400' : a >= 60 ? 'text-amber-400' : 'text-rose-400';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<AnalyticsOverview>('/analytics/overview');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const themes = Object.entries(data?.grammar_theme_breakdown ?? {});

  return (
    <div className="space-y-10 max-w-6xl">
      <PageHeader
        icon={BarChart3}
        kicker="Insights"
        title="Your learning, in numbers"
        subtitle="A precise view of vocabulary progression and grammar mastery over time."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[148px]" />
          ))
        ) : (
          <>
            <Kpi icon={Book} label="Library" value={data?.total_books ?? 0} sub="books uploaded" />
            <Kpi icon={Brain} label="Vocabulary" value={data?.total_cards ?? 0} sub="cards in rotation" />
            <Kpi
              icon={Clock}
              label="Due today"
              value={data?.cards_due_today ?? 0}
              sub="ready for review"
              accent="amber"
            />
            <Kpi
              icon={Target}
              label="Accuracy"
              value={`${data?.quiz_accuracy_rate ?? 0}%`}
              sub={`across ${data?.quiz_total_attempts ?? 0} attempts`}
              accent="emerald"
            />
          </>
        )}
      </section>

      <Card className="overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800/60">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Grammar mastery</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Accuracy by theme, drawn from your quiz history
            </p>
          </div>
          <Badge variant="muted">
            {themes.length} {themes.length === 1 ? 'theme' : 'themes'}
          </Badge>
        </div>

        {!loading && themes.length === 0 && (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            description="Complete a few grammar quizzes and your mastery breakdown will appear here."
            className="border-0 bg-transparent rounded-none"
          />
        )}

        {themes.length > 0 && (
          <div className="divide-y divide-zinc-800/60">
            {themes.map(([theme, stats], i) => (
              <div
                key={theme}
                className="px-6 py-4 transition-colors hover:bg-zinc-800/20"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-medium text-zinc-200">{theme}</span>
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">
                    {stats.correct}/{stats.total}
                    <span className="text-zinc-700 mx-1.5">·</span>
                    <span className={accuracyColor(stats.accuracy)}>
                      {stats.accuracy}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700"
                    style={{
                      width: `${stats.accuracy}%`,
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};