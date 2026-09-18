import React, { useEffect, useState } from 'react';
import { BarChart3, Book, Brain, Clock, HelpCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface AnalyticsOverview {
  total_books: number;
  total_cards: number;
  cards_due_today: number;
  quiz_total_attempts: number;
  quiz_accuracy_rate: number;
  grammar_theme_breakdown: Record<string, { total: number; correct: number; accuracy: number }>;
}

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get<AnalyticsOverview>('/analytics/overview');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics overview:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400">
        <Loader2 size={36} className="animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Aggregating learning stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
          <BarChart3 className="text-indigo-400" size={28} />
          Learning Analytics
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Monitor your vocabulary progression and grammar mastery over time.
        </p>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="bg-indigo-500/10 p-3 rounded-lg text-indigo-400 border border-indigo-500/20">
            <Book size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Books Uploaded</p>
            <p className="text-2xl font-bold text-slate-100">{data?.total_books || 0}</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400 border border-emerald-500/20">
            <Brain size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Vocab Cards</p>
            <p className="text-2xl font-bold text-slate-100">{data?.total_cards || 0}</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-lg text-amber-400 border border-amber-500/20">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Due For Review</p>
            <p className="text-2xl font-bold text-slate-100">{data?.cards_due_today || 0}</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="bg-purple-500/10 p-3 rounded-lg text-purple-400 border border-purple-500/20">
            <HelpCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quiz Accuracy</p>
            <p className="text-2xl font-bold text-slate-100">{data?.quiz_accuracy_rate || 0}%</p>
          </div>
        </div>
      </div>

      {/* Grammar Breakdown */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-slate-200 text-base">Grammar Theme Mastery</h3>

        {!data?.grammar_theme_breakdown || Object.keys(data.grammar_theme_breakdown).length === 0 ? (
          <p className="text-slate-500 text-sm py-4">No quiz logs recorded yet. Complete grammar quizzes to unlock breakdown metrics.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(data.grammar_theme_breakdown).map(([theme, stats]) => (
              <div key={theme} className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-slate-200">{theme}</span>
                  <span className="text-slate-400 font-mono text-xs">
                    {stats.correct} / {stats.total} Correct ({stats.accuracy}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};