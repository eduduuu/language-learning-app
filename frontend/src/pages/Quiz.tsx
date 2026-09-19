import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Segmented,
  Slider,
} from '../components/ui';

interface QuestionData {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

const SUGGESTED_THEMES = ['N4 Te-form', 'N3 Passive voice', 'Conditionals', 'Keigo'];

export const Quiz: React.FC = () => {
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [theme, setTheme] = useState('N4 Te-form usage');
  const [complexity, setComplexity] = useState(3);

  const [loading, setLoading] = useState(false);
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQuiz = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!theme) return;
    setLoading(true);
    setError(null);
    setQuestionData(null);
    setSelectedIndex(null);
    setSubmitted(false);

    try {
      const res = await api.post<QuestionData>('/quiz/generate', {
        language,
        theme,
        complexity,
      });
      setQuestionData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate quiz question.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (selectedIndex === null || !questionData) return;
    setSubmitted(true);
    try {
      await api.post('/quiz/log', {
        theme,
        language,
        complexity,
        is_correct: selectedIndex === questionData.correct_option_index,
      });
    } catch (err) {
      console.error('Failed to log quiz attempt:', err);
    }
  };

  return (
    <div className="space-y-10 max-w-6xl">
      <PageHeader
        icon={HelpCircle}
        kicker="Practice"
        title="Grammar quiz engine"
        subtitle="Sharpen targeted grammar points with dynamically generated questions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Parameters */}
        <div className="lg:col-span-4">
          <Card className="sticky top-6">
            <CardHeader title="Parameters" icon={Sparkles} />
            <form onSubmit={handleGenerateQuiz} className="p-6 space-y-6">
              <div>
                <Label>Language</Label>
                <Segmented
                  value={language}
                  onChange={setLanguage}
                  className="w-full"
                  options={[
                    { value: 'japanese', label: '🇯🇵 Japanese' },
                    { value: 'english', label: '🇺🇸 English' },
                  ]}
                />
              </div>

              <div>
                <Label>Grammar theme</Label>
                <Input
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. Conditionals, Passive voice…"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {SUGGESTED_THEMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-amber-300 border border-zinc-800 hover:border-amber-400/40 rounded-md transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Slider
                label="Complexity"
                min={1}
                max={5}
                value={complexity}
                onChange={setComplexity}
                display={`${complexity} / 5`}
              />

              <Button type="submit" loading={loading} fullWidth size="lg">
                {!loading && <Sparkles size={16} />}
                {loading ? 'Generating…' : 'Generate question'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Question panel */}
        <div className="lg:col-span-8">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {!questionData && !loading && (
            <EmptyState
              icon={HelpCircle}
              title="Ready when you are"
              description="Set your grammar topic on the left, then generate a question to test your understanding."
              className="h-full min-h-[420px]"
            />
          )}

          {loading && (
            <Card className="h-full min-h-[420px] grid place-items-center">
              <LoadingState message="Designing a question with the model…" />
            </Card>
          )}

          {questionData && !loading && (
            <Card className="p-8 animate-fade-in">
              <div className="flex items-center justify-between pb-5 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="text-amber-400">●</span>
                  {theme}
                </div>
                <Badge variant="gold">Level {complexity}/5</Badge>
              </div>

              <h3 className="font-display text-2xl text-zinc-50 leading-snug mt-6 mb-6">
                {questionData.question}
              </h3>

              <div className="space-y-2.5">
                {questionData.options.map((opt, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isCorrect = idx === questionData.correct_option_index;

                  let style =
                    'bg-zinc-950/50 border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900/60';

                  if (submitted) {
                    if (isCorrect)
                      style =
                        'bg-emerald-500/[0.07] border-emerald-500/50 text-emerald-200';
                    else if (isSelected)
                      style = 'bg-rose-500/[0.07] border-rose-500/50 text-rose-200';
                    else
                      style =
                        'bg-zinc-950/30 border-zinc-900 text-zinc-600 cursor-default';
                  } else if (isSelected) {
                    style =
                      'bg-amber-400/[0.06] border-amber-400/60 text-amber-100 ring-2 ring-amber-400/10';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !submitted && setSelectedIndex(idx)}
                      disabled={submitted}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-center justify-between gap-4 ${style}`}
                    >
                      <span className="text-sm leading-relaxed">{opt}</span>
                      {submitted && isCorrect && (
                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                      )}
                      {submitted && isSelected && !isCorrect && (
                        <XCircle size={18} className="text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className="mt-6 p-5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 animate-fade-in">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Explanation
                  </span>
                  <p className="text-sm text-zinc-300 leading-relaxed mt-2">
                    {questionData.explanation}
                  </p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-zinc-800/60">
                {!submitted ? (
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={selectedIndex === null}
                    fullWidth
                    size="lg"
                  >
                    Submit answer
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleGenerateQuiz()}
                    variant="secondary"
                    fullWidth
                    size="lg"
                  >
                    Next question <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};