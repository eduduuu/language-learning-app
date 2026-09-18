import React, { useState } from 'react';
import { HelpCircle, Sparkles, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

interface QuestionData {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

export const Quiz: React.FC = () => {
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [theme, setTheme] = useState<string>('N4 Te-form usage');
  const [complexity, setComplexity] = useState<number>(3);

  const [loading, setLoading] = useState<boolean>(false);
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSelectOption = (index: number) => {
    if (submitted) return;
    setSelectedIndex(index);
  };

  const handleSubmitAnswer = async () => {
    if (selectedIndex === null || !questionData) return;
    setSubmitted(true);

    const isCorrect = selectedIndex === questionData.correct_option_index;

    try {
      await api.post('/quiz/log', {
        theme,
        language,
        complexity,
        is_correct: isCorrect,
      });
    } catch (err) {
      console.error('Failed to log quiz attempt:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
          <HelpCircle className="text-indigo-400" size={28} />
          Grammar Quiz Engine
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Test targeted grammar points generated dynamically on demand.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Setup Panel (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl h-fit space-y-6">
          <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">
            Quiz Parameters
          </h3>

          <form onSubmit={handleGenerateQuiz} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Language
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage('japanese')}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    language === 'japanese'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Japanese
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('english')}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    language === 'english'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Grammar Topic / Theme
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. N3 Passive Voice, Conditionals..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Complexity (1-5)</span>
                <span className="text-indigo-400">{complexity}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white py-3 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Question
                </>
              )}
            </button>
          </form>
        </div>

        {/* Question Panel (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          {!questionData && !loading && (
            <div className="flex-1 bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-center text-slate-500">
              <HelpCircle size={48} className="mb-3 opacity-40 text-indigo-400" />
              <p className="text-base font-medium text-slate-300">Ready to test your knowledge</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Set your grammar topic on the left and start generating AI questions.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 size={40} className="animate-spin text-indigo-400 mb-4" />
              <p className="text-sm font-medium animate-pulse">Designing question with LLM...</p>
            </div>
          )}

          {questionData && !loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
                    Topic: {theme}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Level {complexity}/5
                  </span>
                </div>

                <h3 className="text-xl font-medium text-slate-100 leading-snug">
                  {questionData.question}
                </h3>

                {/* Options List */}
                <div className="space-y-3">
                  {questionData.options.map((opt, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isCorrect = idx === questionData.correct_option_index;

                    let btnStyle = 'bg-slate-900/60 border-slate-700 text-slate-200 hover:border-slate-500';

                    if (submitted) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold';
                      } else if (isSelected && !isCorrect) {
                        btnStyle = 'bg-rose-950/60 border-rose-500 text-rose-200';
                      } else {
                        btnStyle = 'bg-slate-900/30 border-slate-800 text-slate-500';
                      }
                    } else if (isSelected) {
                      btnStyle = 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-semibold';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        disabled={submitted}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${btnStyle}`}
                      >
                        <span className="text-sm">{opt}</span>
                        {submitted && isCorrect && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
                        {submitted && isSelected && !isCorrect && <XCircle size={18} className="text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Block */}
                {submitted && (
                  <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-xl space-y-1 animate-fadeIn">
                    <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                      Explanation
                    </span>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {questionData.explanation}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="pt-4 border-t border-slate-700/80">
                {!submitted ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={selectedIndex === null}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateQuiz}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    Next Question <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};