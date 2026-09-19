import React, { useEffect, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Eye,
  Sliders,
  Sparkles,
  BookOpen,
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

interface SavedBook {
  id: string;
  title: string;
  language: string;
}

interface WordDetail {
  base_word: string;
  conjugated_word: string;
  reading: string;
  meaning: string;
}

interface VocabCard {
  words: string[];
  sentence: string;
  translation: string;
  word_details: WordDetail[];
}

type Rating = 'very_hard' | 'hard' | 'ok' | 'good';

const RATINGS: { id: Rating; label: string; ring: string; text: string }[] = [
  { id: 'very_hard', label: 'Again', ring: 'hover:border-rose-500/60 hover:bg-rose-500/10', text: 'text-rose-300' },
  { id: 'hard', label: 'Hard', ring: 'hover:border-amber-500/60 hover:bg-amber-500/10', text: 'text-amber-300' },
  { id: 'ok', label: 'Good', ring: 'hover:border-sky-500/60 hover:bg-sky-500/10', text: 'text-sky-300' },
  { id: 'good', label: 'Easy', ring: 'hover:border-emerald-500/60 hover:bg-emerald-500/10', text: 'text-emerald-300' },
];

export const Vocabulary: React.FC = () => {
  const [mode, setMode] = useState<'jlpt' | 'books'>('jlpt');
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [jlptLevel, setJlptLevel] = useState('N5');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(10);

  const [sentenceMaxWords, setSentenceMaxWords] = useState(20);
  const [kanjiDensity, setKanjiDensity] = useState(0.5);
  const [targetVocabCount, setTargetVocabCount] = useState(3);

  const [books, setBooks] = useState<SavedBook[]>([]);
  const [card, setCard] = useState<VocabCard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<SavedBook[]>('/epub/books');
        setBooks(res.data);
        if (res.data.length > 0) setSelectedBookId(res.data[0].id);
      } catch (err) {
        console.error('Failed to load books:', err);
      }
    })();
  }, []);

  const handleGenerateCard = async () => {
    setLoading(true);
    setError(null);
    setCard(null);
    setShowAnswer(false);
    setReviewSuccess(false);

    try {
      const res = await api.post<VocabCard>('/vocab/generate', {
        mode,
        language,
        jlpt_level: mode === 'jlpt' ? jlptLevel : undefined,
        book_id: mode === 'books' ? selectedBookId : undefined,
        start_page: startPage,
        end_page: endPage,
        sentence_max_words: sentenceMaxWords,
        kanji_density: kanjiDensity,
        target_vocab_count: targetVocabCount,
      });
      setCard(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate vocabulary sentence.');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (rating: Rating) => {
    if (!card?.words.length) return;
    setReviewing(true);
    try {
      await api.post('/vocab/review', {
        word: card.words[0],
        language,
        rating,
      });
      setReviewSuccess(true);
      setTimeout(() => handleGenerateCard(), 700);
    } catch {
      alert('Failed to save progress.');
    } finally {
      setReviewing(false);
    }
  };

  const renderHighlightedSentence = (sentence: string, details: WordDetail[]) => {
    if (!details?.length) return sentence;
    const words = [...new Set(details.map((d) => d.conjugated_word))].sort(
      (a, b) => b.length - a.length,
    );
    const pattern = new RegExp(`(${words.join('|')})`, 'g');
    return sentence.split(pattern).map((part, i) =>
      words.includes(part) ? (
        <span
          key={i}
          className="text-amber-300 font-medium underline decoration-amber-400/40 decoration-2 underline-offset-[6px]"
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="space-y-10 max-w-7xl">
      <PageHeader
        icon={Brain}
        kicker="Study"
        title="Learn in context"
        subtitle="AI-crafted sentences built from SRS priority and your chosen parameters. Rate each card to feed the algorithm."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Config */}
        <div className="lg:col-span-4">
          <Card className="sticky top-6">
            <CardHeader icon={Sliders} title="Study configuration" />
            <div className="p-6 space-y-5">
              <div>
                <Label>Vocabulary source</Label>
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v)}
                  className="w-full"
                  options={[
                    { value: 'jlpt', label: 'JLPT Core' },
                    { value: 'books', label: 'My books' },
                  ]}
                />
              </div>

              {mode === 'jlpt' ? (
                <div>
                  <Label>JLPT level</Label>
                  <Segmented
                    value={jlptLevel}
                    onChange={setJlptLevel}
                    className="w-full"
                    options={['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => ({
                      value: l,
                      label: l,
                    }))}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Book</Label>
                    <select
                      value={selectedBookId}
                      onChange={(e) => setSelectedBookId(e.target.value)}
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/15"
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
                      <Label>Start</Label>
                      <Input
                        type="number"
                        min={1}
                        value={startPage}
                        onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input
                        type="number"
                        min={1}
                        value={endPage}
                        onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                <Slider
                  label="Max sentence length"
                  min={5}
                  max={30}
                  value={sentenceMaxWords}
                  onChange={setSentenceMaxWords}
                  display={`${sentenceMaxWords} words`}
                />
                {language === 'japanese' && (
                  <Slider
                    label="Kanji density"
                    min={0}
                    max={1}
                    step={0.1}
                    value={kanjiDensity}
                    onChange={setKanjiDensity}
                    display={`${Math.round(kanjiDensity * 100)}%`}
                  />
                )}
                <Slider
                  label="Target words"
                  min={1}
                  max={5}
                  value={targetVocabCount}
                  onChange={setTargetVocabCount}
                  display={`${targetVocabCount}`}
                />
              </div>

              <Button
                onClick={handleGenerateCard}
                disabled={mode === 'books' && !selectedBookId}
                loading={loading}
                fullWidth
                size="lg"
              >
                {!loading && <Sparkles size={16} />}
                {loading ? 'Generating…' : 'Generate card'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Flashcard viewport */}
        <div className="lg:col-span-8">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {!card && !loading && (
            <EmptyState
              icon={Brain}
              title="No active card"
              description="Set your study parameters on the left and generate a card to begin."
              className="h-full min-h-[480px]"
            />
          )}

          {loading && (
            <Card className="grid place-items-center min-h-[480px]">
              <LoadingState message="Composing a sentence…" />
            </Card>
          )}

          {card && !loading && (
            <Card className="relative min-h-[480px] flex flex-col overflow-hidden animate-fade-in">
              {reviewSuccess && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-950/90 backdrop-blur-sm animate-fade-in">
                  <div className="flex flex-col items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={40} className="animate-pulse" />
                    <span className="text-sm font-medium">Progress saved</span>
                  </div>
                </div>
              )}

              <div className="p-8 sm:p-10 flex-1 flex flex-col gap-6">
                {/* Sentence */}
                <div className="flex-1 grid place-items-center min-h-[140px]">
                  <p className="font-display text-3xl sm:text-[2.5rem] leading-[1.35] text-zinc-50 text-center max-w-2xl tracking-tight">
                    {renderHighlightedSentence(card.sentence, card.word_details)}
                  </p>
                </div>

                {/* Reveal */}
                {showAnswer ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-5 rounded-xl bg-amber-400/[0.04] border border-amber-400/20">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-amber-400/90 block mb-2">
                        Translation
                      </span>
                      <p className="text-base text-zinc-100 leading-relaxed">
                        {card.translation}
                      </p>
                    </div>

                    <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500 block mb-4">
                        Vocabulary breakdown
                      </span>
                      <div className="space-y-4">
                        {card.word_details.map((wd, i) => (
                          <div
                            key={i}
                            className="flex flex-col border-l-2 border-amber-400/40 pl-4"
                          >
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <span className="text-lg font-semibold text-zinc-100">
                                {wd.base_word}
                              </span>
                              <span className="text-xs font-mono text-zinc-500">
                                {wd.reading}
                              </span>
                            </div>
                            <span className="text-sm text-zinc-400 mt-1">
                              {wd.meaning}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="w-full py-5 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/40 hover:bg-amber-400/[0.03] text-zinc-400 hover:text-amber-300 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Eye size={16} />
                    Reveal translation & notes
                  </button>
                )}
              </div>

              {showAnswer && (
                <div className="px-8 sm:px-10 py-6 border-t border-zinc-800/60 bg-zinc-950/40">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500 block text-center mb-3">
                    Rate your recall
                  </span>
                  <div className="grid grid-cols-4 gap-2.5">
                    {RATINGS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleReview(r.id)}
                        disabled={reviewing}
                        className={`py-3 rounded-lg border border-zinc-800 bg-zinc-900/60 transition-all text-xs font-semibold ${r.text} ${r.ring} disabled:opacity-50`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};