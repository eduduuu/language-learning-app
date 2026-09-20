import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Compass,
  Dices,
  HelpCircle,
  Layers,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  getGrammarTopics,
  getWeakGrammarTopics,
  generateQuizQuestion,
  logQuizAttempt,
  type GrammarTopic,
  type WeakTopic,
  type QuizQuestion,
} from '../lib/api';
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
import { listLocalBooks, getLocalBook } from '../lib/localBookStore';
import type { BookSummary, LocalBook } from '../types/book';
import { generateLocalSentenceCloze } from '../lib/grammar/cloze';
import { scanBookGrammar, type BookGrammarProfile } from '../lib/grammar/scanner';
import {
  generateVerbConjugationQuestion,
  generatePatternQuestionFromBook,
  generateRandomBookGrammarQuestion,
} from '../lib/grammar/book_questions';

export const Quiz: React.FC = () => {
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');

  // Topics and weak topics
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  // Available books and active book
  const [localBooks, setLocalBooks] = useState<BookSummary[]>([]);
  const [activeBook, setActiveBook] = useState<LocalBook | null>(null);
  const [bookGrammar, setBookGrammar] = useState<BookGrammarProfile | null>(null);
  const [searchBookFirst, setSearchBookFirst] = useState(true);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Custom theme mode
  const [customTheme, setCustomTheme] = useState('');
  const [customComplexity, setCustomComplexity] = useState(3);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Quiz state
  const [activeMode, setActiveMode] = useState<
    'topic' | 'book_cloze' | 'book_verb' | 'book_pattern' | 'book_random' | 'custom' | null
  >(null);
  const [activeTopic, setActiveTopic] = useState<GrammarTopic | null>(null);
  const [questionData, setQuestionData] = useState<QuizQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load topics, weak topics, and active book on mount
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoadingTopics(true);
      try {
        const [fetchedTopics, fetchedWeak, books] = await Promise.all([
          getGrammarTopics(language).catch(() => []),
          getWeakGrammarTopics().catch(() => []),
          listLocalBooks().catch(() => []),
        ]);

        if (!mounted) return;
        setTopics(fetchedTopics);
        setWeakTopics(fetchedWeak);
        setLocalBooks(books);

        if (books.length > 0) {
          const firstBook = await getLocalBook(books[0].id);
          if (firstBook && mounted) {
            setActiveBook(firstBook);
            const profile = scanBookGrammar(firstBook);
            setBookGrammar(profile);
          }
        }
      } catch (err) {
        console.error('Failed to load quiz metadata:', err);
      } finally {
        if (mounted) setLoadingTopics(false);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [language]);

  // Switch chosen book
  const handleSelectBook = async (bookId: string) => {
    try {
      const b = await getLocalBook(bookId);
      if (b) {
        setActiveBook(b);
        const profile = scanBookGrammar(b);
        setBookGrammar(profile);
      }
    } catch (err) {
      console.error('Failed to switch book:', err);
    }
  };

  // Launch a topic quiz (searches active book first if enabled!)
  const handleStartTopicQuiz = async (topic: GrammarTopic) => {
    setActiveMode('topic');
    setActiveTopic(topic);
    setLoading(true);
    setError(null);
    setQuestionData(null);
    setSelectedIndex(null);
    setSubmitted(false);

    // If searchBookFirst is enabled and activeBook exists, search for authentic sentence!
    if (searchBookFirst && activeBook) {
      const bookQuestion = generatePatternQuestionFromBook(activeBook, topic.title);
      if (bookQuestion) {
        setQuestionData(bookQuestion);
        setLoading(false);
        return;
      }
    }

    try {
      const q = await generateQuizQuestion({
        theme: topic.title,
        language: topic.language,
        complexity: Math.min(5, Math.max(1, Math.round(topic.weight / 2))),
        topic_id: topic.id,
      });
      setQuestionData(q);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load question for this topic.');
    } finally {
      setLoading(false);
    }
  };

  // Launch a single-sentence cloze from the user's active book (100% legal, zero LLM)
  const handleStartBookCloze = () => {
    if (!activeBook) return;
    setActiveMode('book_cloze');
    setActiveTopic(null);
    setLoading(true);
    setError(null);
    setQuestionData(null);
    setSelectedIndex(null);
    setSubmitted(false);

    // Pick a random sentence with candidate particles from the active book
    const sentences: string[] = [];
    activeBook.chapters.forEach((ch) => {
      ch.paragraphs.forEach((p) => {
        p.sentences.forEach((s) => {
          if (s.text && s.text.trim().length >= 8 && s.text.trim().length <= 60) {
            sentences.push(s.text.trim());
          }
        });
      });
    });

    if (sentences.length === 0) {
      setError('No suitable sentences found in your book for cloze practice.');
      setLoading(false);
      return;
    }

    // Try a few random sentences until cloze generator matches
    let clozeResult = null;
    const shuffled = [...sentences].sort(() => 0.5 - Math.random());
    for (const s of shuffled.slice(0, 15)) {
      clozeResult = generateLocalSentenceCloze(s);
      if (clozeResult) break;
    }

    if (clozeResult) {
      setQuestionData({
        question: clozeResult.question,
        options: clozeResult.options,
        correct_option_index: clozeResult.correct_option_index,
        explanation: clozeResult.explanation,
        source: 'book_context',
      });
    } else {
      setError('Could not generate a particle cloze from the current chapter.');
    }
    setLoading(false);
  };

  // Launch a verb conjugation drill from verbs found in the user's book
  const handleStartVerbConjugation = () => {
    if (!activeBook) return;
    setActiveMode('book_verb');
    setActiveTopic(null);
    setLoading(true);
    setError(null);
    setQuestionData(null);
    setSelectedIndex(null);
    setSubmitted(false);

    const q = generateVerbConjugationQuestion(activeBook);
    if (q) {
      setQuestionData(q);
    } else {
      setError('No suitable verbs found in this book for conjugation practice.');
    }
    setLoading(false);
  };

  // Launch a random grammar question from the user's book
  const handleStartRandomBookQuestion = () => {
    if (!activeBook) return;
    setActiveMode('book_random');
    setActiveTopic(null);
    setLoading(true);
    setError(null);
    setQuestionData(null);
    setSelectedIndex(null);
    setSubmitted(false);

    const q = generateRandomBookGrammarQuestion(activeBook);
    if (q) {
      setQuestionData(q);
    } else {
      handleStartBookCloze();
    }
    setLoading(false);
  };

  // Launch custom theme quiz
  const handleStartCustomQuiz = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customTheme.trim()) return;
    setActiveMode('custom');
    setActiveTopic(null);
    setLoading(true);
    setError(null);
    setQuestionData(null);
    setSelectedIndex(null);
    setSubmitted(false);
    setShowCustomModal(false);

    try {
      const q = await generateQuizQuestion({
        theme: customTheme.trim(),
        language,
        complexity: customComplexity,
      });
      setQuestionData(q);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate question.');
    } finally {
      setLoading(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (selectedIndex === null || !questionData) return;
    setSubmitted(true);

    const themeName =
      activeTopic?.title ||
      (activeMode === 'book_cloze'
        ? 'Book Particle Cloze'
        : activeMode === 'book_verb'
        ? 'Book Verb Conjugation'
        : activeMode === 'book_random'
        ? 'Book Grammar Drill'
        : customTheme) ||
      'General Grammar';

    try {
      await logQuizAttempt({
        theme: themeName,
        language,
        complexity: activeTopic ? Math.min(5, Math.max(1, Math.round(activeTopic.weight / 2))) : customComplexity,
        is_correct: selectedIndex === questionData.correct_option_index,
        question_id: questionData.id,
      });
    } catch (err) {
      console.error('Failed to log quiz attempt:', err);
    }
  };

  // Next question
  const handleNextQuestion = () => {
    if (activeMode === 'book_cloze') {
      handleStartBookCloze();
    } else if (activeMode === 'book_verb') {
      handleStartVerbConjugation();
    } else if (activeMode === 'book_random') {
      handleStartRandomBookQuestion();
    } else if (activeMode === 'topic' && activeTopic) {
      void handleStartTopicQuiz(activeTopic);
    } else if (activeMode === 'custom' && customTheme) {
      void handleStartCustomQuiz();
    }
  };

  // Filtered topics
  const filteredTopics = topics.filter((t) => {
    if (levelFilter !== 'all' && t.level.toLowerCase() !== levelFilter.toLowerCase()) {
      return false;
    }
    if (categoryFilter !== 'all' && t.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const topWeakTopic = weakTopics.length > 0 ? weakTopics[0] : null;

  return (
    <div className="space-y-10 max-w-6xl">
      <PageHeader
        icon={HelpCircle}
        kicker="Grammar Practice"
        title="Grammar engine & practice hub"
        subtitle="Zero-LLM sentence clozes from your books, curated JLPT topics, and adaptive weak-point training."
      />

      {/* =========================================================================
          TOP ACTION ROW: "NEEDS REVIEW" ALERT & "PRACTICE FROM BOOK"
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Needs Review Card */}
        {topWeakTopic ? (
          <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] backdrop-blur-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
                  <AlertTriangle size={12} />
                  Needs Practice
                </span>
                <span className="text-xs text-zinc-400">
                  {topWeakTopic.accuracy}% Accuracy ({topWeakTopic.total} attempts)
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-100">
                {topWeakTopic.theme}
              </h3>
              {topWeakTopic.rule_explanation && (
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed line-clamp-2">
                  {topWeakTopic.rule_explanation}
                </p>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const matched = topics.find(
                  (t) =>
                    t.title.toLowerCase().includes(topWeakTopic.theme.toLowerCase()) ||
                    topWeakTopic.theme.toLowerCase().includes(t.title.toLowerCase())
                );
                if (matched) {
                  void handleStartTopicQuiz(matched);
                } else {
                  setCustomTheme(topWeakTopic.theme);
                  void handleStartCustomQuiz();
                }
              }}
              className="self-start text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
            >
              <RotateCcw size={14} />
              Review & Drill Questions
            </Button>
          </div>
        ) : (
          <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 size={14} />
                Grammar Health Good
              </div>
              <h3 className="text-base font-semibold text-zinc-200">
                Adaptive Mastery Engine
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                As you answer questions, your lowest-scoring grammar points will appear here with instant rule reminders.
              </p>
            </div>
            <div className="text-[11px] text-zinc-500">Pick any topic below to begin.</div>
          </div>
        )}

        {/* 2. Practice from Your Book Card */}
        {activeBook ? (
          <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold">
                  <BookOpen size={12} />
                  Book Grammar Practice
                </span>
                {bookGrammar && (
                  <span className="text-xs text-amber-400 font-medium">
                    Difficulty: {bookGrammar.difficultyScore} / 10 • {bookGrammar.levelLabel.split(' ')[0]}
                  </span>
                )}
              </div>

              {/* Book Selector Dropdown */}
              <div className="mt-2 mb-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                  <BookMarked size={12} className="text-amber-400" />
                  Target Book
                </div>
                <select
                  value={activeBook.summary.id}
                  onChange={(e) => void handleSelectBook(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 text-xs rounded-lg px-3 py-2 text-zinc-100 font-medium focus:outline-none focus:border-amber-400"
                >
                  {localBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      📖 {b.title}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                {bookGrammar?.topGrammarThemes.length
                  ? `Contains ${bookGrammar.topGrammarThemes.slice(0, 2).join(', ')}. Practice authentic sentence clozes or verb conjugations.`
                  : 'Practice single-sentence particle clozes and verb conjugations directly from your reading material.'}
              </p>
            </div>

            {/* Diverse Practice Modes */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/60">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStartBookCloze}
                className="text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10"
              >
                <Sparkles size={13} />
                Sentence Cloze
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStartVerbConjugation}
                className="text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
              >
                <RotateCcw size={13} />
                Verb Conjugation
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStartRandomBookQuestion}
                className="text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Dices size={13} />
                Random Drill
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-semibold">
                <BookOpen size={14} />
                No Active Book Yet
              </div>
              <h3 className="text-base font-semibold text-zinc-200">
                Book Context Practice
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Upload an EPUB in the library to enable sentence fill-in-the-blank clozes directly from your books.
              </p>
            </div>
            <div className="text-[11px] text-zinc-500">Zero LLM • 100% Private</div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MAIN INTERFACE: QUESTION DISPLAY OR TOPIC BROWSER
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Topic Filters & Custom Theme */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-5 space-y-5 sticky top-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 flex items-center gap-1.5">
                <Compass size={14} />
                Grammar Topics
              </span>
              <button
                type="button"
                onClick={() => setShowCustomModal((prev) => !prev)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium"
              >
                {showCustomModal ? 'Close Custom' : '+ Custom Topic'}
              </button>
            </div>

            {/* Search in Book First Toggle */}
            {activeBook && (
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 cursor-pointer text-xs text-zinc-300 hover:border-amber-400/30 transition-colors">
                <input
                  type="checkbox"
                  checked={searchBookFirst}
                  onChange={(e) => setSearchBookFirst(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-400 focus:ring-amber-400/20 bg-zinc-900"
                />
                <span className="text-[11px] leading-snug">
                  Search in <strong>{activeBook.summary.title}</strong> first for authentic sentences
                </span>
              </label>
            )}

            {/* Custom Topic Form (Toggleable) */}
            {showCustomModal && (
              <form
                onSubmit={handleStartCustomQuiz}
                className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-4 animate-fade-in"
              >
                <div className="text-xs font-medium text-zinc-200">
                  Custom Grammar Topic
                </div>
                <Input
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  placeholder="e.g. Passive voice with indirect object"
                  required
                />
                <Slider
                  label="Complexity"
                  min={1}
                  max={5}
                  value={customComplexity}
                  onChange={setCustomComplexity}
                  display={`${customComplexity} / 5`}
                />
                <Button type="submit" size="sm" fullWidth loading={loading}>
                  Generate Question
                </Button>
              </form>
            )}

            {/* Level Filter Chips */}
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2 block">
                JLPT Level
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {['all', 'N5', 'N4', 'N3'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      levelFilter === lvl
                        ? 'bg-amber-400 text-zinc-950 shadow'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Chips */}
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2 block">
                Category
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'particles', label: '助詞 (Particles)' },
                  { id: 'verbs', label: '動詞 (Verbs)' },
                  { id: 'conditionals', label: '条件 (Conditionals)' },
                  { id: 'modality', label: 'モダリティ (Modality)' },
                  { id: 'keigo', label: '敬語 (Keigo)' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                      categoryFilter === cat.id
                        ? 'bg-zinc-100 text-zinc-950 font-medium'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic List */}
            <div className="pt-2 border-t border-zinc-800 space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredTopics.length === 0 && (
                <div className="text-xs text-zinc-500 text-center py-4">
                  No topics found for this filter.
                </div>
              )}
              {filteredTopics.map((topic) => {
                const isCurrent = activeTopic?.id === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => void handleStartTopicQuiz(topic)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                      isCurrent
                        ? 'bg-amber-400/10 border-amber-400/50 text-amber-200'
                        : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/60 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-100 line-clamp-1">
                        {topic.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 shrink-0 font-medium">
                        {topic.level}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 line-clamp-1">
                      {topic.summary}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right column: Question Panel */}
        <div className="lg:col-span-8">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <Card className="h-full min-h-[440px] grid place-items-center">
              <LoadingState message="Preparing question from grammar catalog…" />
            </Card>
          )}

          {!questionData && !loading && (
            <EmptyState
              icon={Layers}
              title="Select a grammar topic or book drill"
              description="Choose a curated JLPT topic on the left, or launch a zero-LLM context cloze from your active book to test your understanding."
              className="h-full min-h-[440px]"
            />
          )}

          {questionData && !loading && (
            <Card className="p-8 animate-fade-in">
              <div className="flex items-center justify-between pb-5 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="text-amber-400">●</span>
                  <span className="font-medium text-zinc-200">
                    {activeTopic?.title ||
                      (activeMode === 'book_cloze'
                        ? `Book Context: ${activeBook?.summary.title}`
                        : customTheme)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {questionData.source === 'book_context' ? (
                    <Badge variant="gold">Book Context</Badge>
                  ) : questionData.source === 'preseeded' ? (
                    <Badge variant="success">Instant Bank</Badge>
                  ) : questionData.source === 'rule_engine' ? (
                    <Badge variant="muted">Rule Engine</Badge>
                  ) : (
                    <Badge variant="muted">AI Generated</Badge>
                  )}
                </div>
              </div>

              <h3 className="font-display text-2xl text-zinc-50 leading-snug mt-6 mb-6 whitespace-pre-line">
                {questionData.question}
              </h3>

              <div className="space-y-3">
                {questionData.options.map((opt, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isCorrect = idx === questionData.correct_option_index;

                  let style =
                    'bg-zinc-950/50 border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900/60';

                  if (submitted) {
                    if (isCorrect) {
                      style =
                        'bg-emerald-500/[0.08] border-emerald-500/60 text-emerald-100 ring-1 ring-emerald-500/20';
                    } else if (isSelected) {
                      style = 'bg-rose-500/[0.08] border-rose-500/60 text-rose-100';
                    } else {
                      style = 'bg-zinc-950/30 border-zinc-900 text-zinc-600 cursor-default';
                    }
                  } else if (isSelected) {
                    style =
                      'bg-amber-400/[0.07] border-amber-400/60 text-amber-100 ring-2 ring-amber-400/15';
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
                <div className="mt-6 space-y-4 animate-fade-in">
                  <div className="p-5 rounded-xl bg-zinc-950/70 border border-zinc-800/90">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500 block mb-1">
                      Explanation
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                      {questionData.explanation}
                    </p>
                  </div>

                  {(activeTopic?.rule_explanation || questionData.rule_explanation) && (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-300 leading-relaxed">
                      <span className="text-amber-300 font-semibold block mb-1">
                        Grammar Rule Breakdown
                      </span>
                      {activeTopic?.rule_explanation || questionData.rule_explanation}
                    </div>
                  )}
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
                    onClick={handleNextQuestion}
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