import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, BookOpen, Sliders, CheckCircle2, RotateCcw, Loader2, Eye } from 'lucide-react';
import { api } from '../lib/api';

interface SavedBook {
  id: string;
  title: string;
  language: string;
}

interface VocabCard {
  words: string[];
  sentence: string;
  translation: string;
  reading_notes?: string;
}

export const Vocabulary: React.FC = () => {
  // Source Configuration State
  const [mode, setMode] = useState<'jlpt' | 'books'>('jlpt');
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(10);

  // AI Parameters State
  const [sentenceMaxWords, setSentenceMaxWords] = useState<number>(20);
  const [kanjiDensity, setKanjiDensity] = useState<number>(0.5);
  const [targetVocabCount, setTargetVocabCount] = useState<number>(3);

  // Card & UI State
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [card, setCard] = useState<VocabCard | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [reviewing, setReviewing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await api.get<SavedBook[]>('/epub/books');
      setBooks(res.data);
      if (res.data.length > 0) {
        setSelectedBookId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load books for study source:', err);
    }
  };

  const handleGenerateCard = async () => {
    setLoading(true);
    setError(null);
    setCard(null);
    setShowAnswer(false);
    setReviewSuccess(false);

    const payload = {
      mode,
      language,
      jlpt_level: mode === 'jlpt' ? jlptLevel : undefined,
      book_id: mode === 'books' ? selectedBookId : undefined,
      start_page: startPage,
      end_page: endPage,
      sentence_max_words: sentenceMaxWords,
      kanji_density: kanjiDensity,
      target_vocab_count: targetVocabCount,
    };

    try {
      const res = await api.post<VocabCard>('/vocab/generate', payload);
      setCard(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate vocabulary sentence.');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (rating: 'very_hard' | 'hard' | 'ok' | 'good') => {
    if (!card || card.words.length === 0) return;
    setReviewing(true);

    try {
      // Log rating for the primary target word in the card
      await api.post('/vocab/review', {
        word: card.words[0],
        language,
        rating,
      });

      setReviewSuccess(true);
      setTimeout(() => {
        handleGenerateCard();
      }, 800);
    } catch (err) {
      alert('Failed to save SRS progress.');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
          <Brain className="text-indigo-400" size={28} />
          Learn Vocabulary
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Generate dynamic AI practice sentences based on SRS priority and target parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider flex items-center gap-2">
            <Sliders size={16} className="text-indigo-400" />
            Study Configuration
          </h3>

          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Vocabulary Source
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('jlpt')}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === 'jlpt'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                JLPT Core
              </button>
              <button
                onClick={() => setMode('books')}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === 'books'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Saved Books
              </button>
            </div>
          </div>

          {/* Source Options */}
          {mode === 'jlpt' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                JLPT Level
              </label>
              <select
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {['N5', 'N4', 'N3', 'N2', 'N1'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} Level
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Book
                </label>
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {books.length === 0 ? (
                    <option value="">No books uploaded</option>
                  ) : (
                    books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Page</label>
                  <input
                    type="number"
                    min={1}
                    value={startPage}
                    onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">End Page</label>
                  <input
                    type="number"
                    min={1}
                    value={endPage}
                    onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parameter Sliders */}
          <div className="space-y-4 border-t border-slate-700/60 pt-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>Max Sentence Words</span>
                <span className="text-indigo-400">{sentenceMaxWords}</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                value={sentenceMaxWords}
                onChange={(e) => setSentenceMaxWords(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {language === 'japanese' && (
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Kanji vs. Hiragana Density</span>
                  <span className="text-indigo-400">{Math.round(kanjiDensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={kanjiDensity}
                  onChange={(e) => setKanjiDensity(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>Target Words Count</span>
                <span className="text-indigo-400">{targetVocabCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={targetVocabCount}
                onChange={(e) => setTargetVocabCount(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateCard}
            disabled={loading || (mode === 'books' && !selectedBookId)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white py-3 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generating Prompt...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Card
              </>
            )}
          </button>
        </div>

        {/* Card Viewport Column (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          {!card && !loading && (
            <div className="flex-1 bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-center text-slate-500">
              <Brain size={48} className="mb-3 opacity-40 text-indigo-400" />
              <p className="text-base font-medium text-slate-300">No active flashcard loaded</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Configure your source settings on the left and click "Generate Card" to start studying.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 size={40} className="animate-spin text-indigo-400 mb-4" />
              <p className="text-sm font-medium animate-pulse">Constructing contextual sentence with Groq LLM...</p>
            </div>
          )}

          {card && !loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl flex flex-col justify-between flex-1 relative overflow-hidden">
              {reviewSuccess && (
                <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-emerald-300">
                  <CheckCircle2 size={48} className="mb-2 animate-bounce" />
                  <p className="font-semibold text-lg">Card Reviewed!</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Words Header */}
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Target Vocabulary</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {card.words.map((w, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold rounded-md text-sm"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Primary Sentence */}
                <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-700/80">
                  <p className="text-2xl font-serif text-slate-100 tracking-wide leading-relaxed">
                    {card.sentence}
                  </p>
                  {card.reading_notes && (
                    <p className="text-xs font-mono text-slate-400 mt-3 pt-3 border-t border-slate-800">
                      Reading Notes: {card.reading_notes}
                    </p>
                  )}
                </div>

                {/* Translation Reveal Area */}
                {showAnswer ? (
                  <div className="p-5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-indigo-200 text-base animate-fadeIn">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 block mb-1">
                      Translation
                    </span>
                    {card.translation}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="w-full py-4 bg-slate-900/40 border border-slate-700/60 hover:bg-slate-700/30 text-slate-300 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Eye size={18} />
                    Reveal Translation
                  </button>
                )}
              </div>

              {/* Anki Review Rating Buttons */}
              {showAnswer && (
                <div className="mt-8 pt-6 border-t border-slate-700/80 space-y-3">
                  <span className="text-xs font-semibold text-slate-400 block text-center">
                    Rate Recall Difficulty (SM-2 SRS Algorithm)
                  </span>
                  <div className="grid grid-cols-4 gap-3">
                    <button
                      onClick={() => handleReview('very_hard')}
                      disabled={reviewing}
                      className="py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      Very Hard
                    </button>
                    <button
                      onClick={() => handleReview('hard')}
                      disabled={reviewing}
                      className="py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      Hard
                    </button>
                    <button
                      onClick={() => handleReview('ok')}
                      disabled={reviewing}
                      className="py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => handleReview('good')}
                      disabled={reviewing}
                      className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      Good
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};