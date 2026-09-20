import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Book,
  BookCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Hash,
  Info,
  Layers,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { Badge, Button, Card, Input, PageHeader, Segmented } from '../components/ui';
import { api, getSRSCards } from '../lib/api';
import {
  analyzeBookVocabulary,
  BookGrammarProfile,
  BookVocabularyProfile,
  scanBookGrammar,
} from '../lib/grammar/scanner';
import { CardManagerModal } from '../components/srs/CardManagerModal';
import { exportBookToAnkiDeck } from '../lib/anki/book_deck';
import {
  createLocalBookFromEpub,
  deleteLocalBook,
  getLocalBook,
  listLocalBooks,
  updateLocalBookStatus,
} from '../lib/localBookStore';
import type { BookLanguage, BookStatus, BookSummary, LocalBook } from '../types/book';

interface AnalyticsData {
  total_books: number;
  total_cards: number;
  cards_due_today: number;
  words_mastered: number;
  current_streak: number;
}

interface HomeDashboardProps {
  onNavigate?: (tab: string, params?: { bookId?: string }) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookStatus>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<BookLanguage>('japanese');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [aboutBookId, setAboutBookId] = useState<string | null>(null);
  const [aboutBookData, setAboutBookData] = useState<{
    book: LocalBook;
    vocabProfile: BookVocabularyProfile;
    grammarProfile: BookGrammarProfile;
  } | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [knownWordsSet, setKnownWordsSet] = useState<Set<string>>(new Set());

  const [showCardManager, setShowCardManager] = useState(false);
  const [cardManagerBookId, setCardManagerBookId] = useState<string | undefined>(undefined);
  const [exportingDeck, setExportingDeck] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);

  const handleExportBookDeck = async (book: LocalBook) => {
    setExportingDeck(true);
    setExportProgressText('Preparing deck…');
    try {
      await exportBookToAnkiDeck({
        book,
        maxCards: 1000,
        onProgress: (_curr, _tot, msg) => {
          setExportProgressText(msg);
        },
      });
    } catch (err) {
      alert((err as Error).message || 'Failed to export deck.');
    } finally {
      setExportingDeck(false);
      setExportProgressText(null);
    }
  };

  const refreshBooks = async () => {
    setLoading(true);
    try {
      setBooks(await listLocalBooks());
    } catch (error) {
      console.error('Failed to load local library:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshBooks();

    api.get<AnalyticsData>('/analytics/overview')
      .then((res) => setAnalytics(res.data))
      .catch((err) => console.warn('Could not load analytics overview:', err));

    getSRSCards('japanese')
      .then((cards) => {
        const set = new Set(cards.map((c) => c.word));
        setKnownWordsSet(set);
      })
      .catch((err) => console.warn('Could not load SRS cards for vocab matching:', err));
  }, []);

  const handleOpenAbout = async (bookId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setAboutBookId(bookId);
    setAboutLoading(true);
    try {
      const fullBook = await getLocalBook(bookId);
      if (!fullBook) {
        setAboutBookId(null);
        return;
      }
      const vocabProfile = analyzeBookVocabulary(fullBook, knownWordsSet);
      const grammarProfile = scanBookGrammar(fullBook);
      setAboutBookData({ book: fullBook, vocabProfile, grammarProfile });
    } catch (error) {
      console.error('Failed to load book about details:', error);
    } finally {
      setAboutLoading(false);
    }
  };

  const closeAboutModal = () => {
    setAboutBookId(null);
    setAboutBookData(null);
  };

  const activeBook =
    books.find((book) => book.status === 'learning') ?? books[0];

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return books.filter((book) => {
      const statusMatches =
        statusFilter === 'all' || book.status === statusFilter;

      const searchMatches =
        !query || book.title.toLowerCase().includes(query);

      return statusMatches && searchMatches;
    });
  }, [books, search, statusFilter]);

  const closeDrawer = () => {
    if (importing) return;

    setDrawerOpen(false);
    setSelectedFile(null);
    setTitle('');
    setLanguage('japanese');
    setImportProgress(null);
  };

  const handleImport = async () => {
    if (!selectedFile || importing) return;

    if (!selectedFile.name.toLowerCase().endsWith('.epub')) {
      setImportProgress('Please select an EPUB file.');
      return;
    }

    const bookTitle =
      title.trim() ||
      selectedFile.name.replace(/\.epub$/i, '');

    try {
      setImporting(true);
      setImportProgress('Starting local import…');

      const created = await createLocalBookFromEpub(
        bookTitle,
        language,
        selectedFile,
        (message) => setImportProgress(message)
      );

      await refreshBooks();

      setDrawerOpen(false);
      setSelectedFile(null);
      setTitle('');
      setLanguage('japanese');
      setImportProgress(null);

      onNavigate?.('reader', { bookId: created.id });
    } catch (error) {
      console.error('Failed to import EPUB:', error);
      setImportProgress(
        error instanceof Error
          ? error.message
          : 'Failed to import EPUB.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (
    bookId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    if (!window.confirm('Remove this book from your local library?')) {
      return;
    }

    try {
      await deleteLocalBook(bookId);
      await refreshBooks();
    } catch (error) {
      console.error('Failed to delete local book:', error);
    }
  };

  const handleStatusChange = async (
    bookId: string,
    status: BookStatus
  ) => {
    try {
      await updateLocalBookStatus(bookId, status);
      await refreshBooks();
    } catch (error) {
      console.error('Failed to update book status:', error);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <PageHeader
        icon={BookOpen}
        kicker="Library"
        title="Welcome back, Reader"
        subtitle="Read your books locally, turn discoveries into vocabulary, and build your Japanese knowledge through context."
        action={
          <Button size="lg" onClick={() => setDrawerOpen(true)}>
            <Plus size={16} />
            Add Book
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame size={19} />}
          label="Reading Streak"
          value={`${analytics?.current_streak ?? 0} ${analytics?.current_streak === 1 ? 'day' : 'days'}`}
        />
        <StatCard
          icon={<BookOpen size={19} />}
          label="Words Mastered"
          value={(analytics?.words_mastered ?? 0).toLocaleString()}
        />
        <StatCard
          icon={<Clock size={19} />}
          label="Reviews Due"
          value={`${analytics?.cards_due_today ?? 0}`}
        />
        <StatCard
          icon={<Book size={19} />}
          label="Active Books"
          value={`${books.filter((book) => book.status === 'learning').length}`}
        />
      </div>

      {activeBook && (
        <Card className="relative overflow-hidden border-amber-400/20 bg-gradient-to-br from-zinc-900 via-zinc-900/70 to-amber-950/20">
          <div className="absolute right-0 top-0 w-72 h-72 bg-amber-400/[0.03] blur-3xl pointer-events-none" />

          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-28 rounded-lg overflow-hidden border border-zinc-700/70 bg-zinc-950 flex items-center justify-center shrink-0">
                {activeBook.coverUrl ? (
                  <img
                    src={activeBook.coverUrl}
                    alt={activeBook.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Book size={28} className="text-amber-400/40" />
                )}
              </div>

              <div>
                <Badge variant="gold">Continue Reading</Badge>
                <h2 className="font-display text-3xl text-zinc-50 mt-3">
                  {activeBook.title}
                </h2>

                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500">
                  <span>
                    {activeBook.knownWords.toLocaleString()} /{' '}
                    {activeBook.totalWords.toLocaleString()} words
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400">
                    {activeBook.mastery}% mastery
                  </span>
                </div>

                <div className="mt-4 w-56 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{
                      width: `${Math.min(100, Math.max(0, activeBook.mastery))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => void handleOpenAbout(activeBook.id)}
              >
                <Info size={16} />
                About Book
              </Button>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() =>
                  onNavigate?.('reader', { bookId: activeBook.id })
                }
              >
                <BookOpen size={16} />
                Continue Reading
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <PracticeCard
          label="Daily Review"
          title={`${analytics?.cards_due_today ?? 0} cards due`}
          description="Review vocabulary from your books."
          icon={<Sparkles size={17} />}
          action="Start Review"
          onClick={() => onNavigate?.('vocab')}
        />

        <PracticeCard
          label="Weak Vocabulary"
          title="10 words need attention"
          description="Practice words you've struggled with recently."
          icon={<Search size={17} />}
          action="Practice"
          onClick={() => onNavigate?.('vocab')}
        />

        <PracticeCard
          label="Grammar"
          title="Quick grammar practice"
          description="Test your understanding of Japanese patterns."
          icon={<CheckCircle2 size={17} />}
          action="Take Quiz"
          onClick={() => onNavigate?.('quiz')}
        />
      </div>

      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-zinc-100">My Library</h2>
            <p className="text-xs text-zinc-600 mt-1">
              Your EPUB content is stored locally on this device. Learning metadata can sync to the backend.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search books…"
              className="w-52"
            />

            <Segmented
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as 'all' | BookStatus)
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'learning', label: 'Learning' },
                { value: 'on_hold', label: 'On Hold' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center text-sm text-zinc-600">
            Loading library…
          </div>
        ) : filteredBooks.length === 0 ? (
          <Card className="p-12 text-center">
            <Book size={28} className="mx-auto text-zinc-700" />
            <h3 className="text-sm font-semibold text-zinc-200 mt-4">
              No books found
            </h3>
            <p className="text-xs text-zinc-600 mt-2">
              Add a book to start building your local library.
            </p>
            <div className="mt-5">
              <Button onClick={() => setDrawerOpen(true)}>
                <Plus size={14} />
                Add Book
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onOpen={() =>
                  onNavigate?.('reader', { bookId: book.id })
                }
                onDelete={(event) => handleDelete(book.id, event)}
                onStatusChange={(status) =>
                  handleStatusChange(book.id, status)
                }
                onAbout={(event) => void handleOpenAbout(book.id, event)}
              />
            ))}
          </div>
        )}
      </section>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full p-6 flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-amber-400 font-semibold">
                  Library
                </div>
                <h2 className="font-display text-2xl text-zinc-100 mt-1">
                  Add Book
                </h2>
              </div>

              <button
                type="button"
                disabled={importing}
                onClick={closeDrawer}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 py-6 space-y-5">
              <label className="block">
                <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center hover:border-amber-400/30 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".epub,application/epub+zip"
                    className="hidden"
                    disabled={importing}
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }
                  />

                  <Upload size={24} className="mx-auto text-amber-400/70" />
                  <div className="text-sm text-zinc-300 mt-3">
                    {selectedFile
                      ? selectedFile.name
                      : 'Choose an EPUB'}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Processed locally in your browser
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-2">
                  Book title
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Kokoro"
                  disabled={importing}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-2">
                  Language
                </label>
                <Segmented
                  value={language}
                  onChange={(value) =>
                    setLanguage(value as BookLanguage)
                  }
                  className="w-full"
                  options={[
                    { value: 'japanese', label: '🇯🇵 Japanese' },
                    { value: 'english', label: '🇺🇸 English' },
                  ]}
                />
              </div>

              {importProgress && (
                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.025] p-4">
                  <div className="text-xs font-medium text-zinc-300">
                    Local processing
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-1.5">
                    {importProgress}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.025] p-4">
                <div className="text-xs font-medium text-zinc-300">
                  Local-first reading
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed mt-1.5">
                  The EPUB is parsed and stored on this device. Only learning metadata and vocabulary are synchronized with the backend.
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-zinc-800">
              <Button
                fullWidth
                size="lg"
                disabled={!selectedFile || importing}
                onClick={() => void handleImport()}
              >
                <Sparkles size={15} />
                {importing ? 'Importing…' : 'Import Book'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {aboutBookId !== null && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 md:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-20 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex items-center justify-center shrink-0">
                  {aboutBookData?.book.summary.coverUrl ? (
                    <img
                      src={aboutBookData.book.summary.coverUrl}
                      alt={aboutBookData.book.summary.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Book size={24} className="text-amber-400/40" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="gold">
                      {aboutBookData?.book.summary.language === 'japanese' ? '🇯🇵 Japanese' : '🇺🇸 English'}
                    </Badge>
                    <Badge variant="muted">
                      {aboutBookData?.book.summary.status === 'learning'
                        ? 'Learning'
                        : aboutBookData?.book.summary.status === 'on_hold'
                        ? 'On Hold'
                        : 'Completed'}
                    </Badge>
                  </div>
                  <h2 className="font-display text-2xl text-zinc-100 mt-1.5 line-clamp-1">
                    {aboutBookData?.book.summary.title ?? 'Book Details'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      Added: {aboutBookData?.book.summary.createdAt ? new Date(aboutBookData.book.summary.createdAt).toLocaleDateString() : 'Recently'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Last opened: {aboutBookData?.book.summary.lastOpenedAt ? new Date(aboutBookData.book.summary.lastOpenedAt).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAboutModal}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {aboutLoading ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-400">Analyzing book vocabulary & grammar complexity…</p>
              </div>
            ) : aboutBookData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Total Words
                    </div>
                    <div className="text-lg font-bold text-zinc-100 mt-1">
                      {aboutBookData.vocabProfile.totalWords.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">Tokens parsed</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Unique Words
                    </div>
                    <div className="text-lg font-bold text-zinc-100 mt-1">
                      {aboutBookData.vocabProfile.uniqueWords.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">Distinct lemmas</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Known Vocab
                    </div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {aboutBookData.vocabProfile.knownWords.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {aboutBookData.vocabProfile.knownPercentage}% coverage
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Mastery
                    </div>
                    <div className="text-lg font-bold text-amber-400 mt-1">
                      {aboutBookData.book.summary.mastery}%
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">Reading progress</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} className="text-amber-400" />
                      <h4 className="text-sm font-semibold text-zinc-100">
                        {aboutBookData.book.summary.language === 'japanese'
                          ? 'Vocabulary & Kanji Complexity'
                          : 'Vocabulary & Lexical Complexity'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="gold">
                        {aboutBookData.vocabProfile.levelLabel}
                      </Badge>
                      <span className="text-sm font-bold text-amber-400">
                        {aboutBookData.vocabProfile.score.toFixed(1)} / 10
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400 flex items-center justify-between">
                    <span>
                      {aboutBookData.vocabProfile.details.unitName === 'kanji' ? (
                        <>
                          Contains <strong className="text-zinc-200">{aboutBookData.vocabProfile.details.uniqueUnits.toLocaleString()}</strong> unique kanji ({aboutBookData.vocabProfile.details.totalUnits.toLocaleString()} total occurrences)
                        </>
                      ) : (
                        <>
                          Contains <strong className="text-zinc-200">{aboutBookData.vocabProfile.uniqueWords.toLocaleString()}</strong> unique words ({aboutBookData.vocabProfile.totalWords.toLocaleString()} total words)
                        </>
                      )}
                    </span>
                  </div>

                  {/* Modular Stacked Progress Bar */}
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-full bg-zinc-950 overflow-hidden flex">
                      {aboutBookData.vocabProfile.distribution.map((tier) =>
                        tier.percent > 0 ? (
                          <div
                            key={tier.id}
                            className={`h-full ${tier.bgClass}`}
                            style={{ width: `${tier.percent}%` }}
                            title={`${tier.shortLabel}: ${tier.percent}%`}
                          />
                        ) : null
                      )}
                    </div>

                    {/* Modular Breakdown Legend */}
                    <div
                      className={`grid gap-2 text-center text-[10px] pt-1 ${
                        aboutBookData.vocabProfile.distribution.length === 6
                          ? 'grid-cols-3 sm:grid-cols-6'
                          : 'grid-cols-5'
                      }`}
                    >
                      {aboutBookData.vocabProfile.distribution.map((tier) => (
                        <div
                          key={tier.id}
                          className={`rounded-lg ${tier.badgeBgClass} border ${tier.borderClass} py-1.5 px-1`}
                        >
                          <div className={`font-semibold ${tier.textClass}`}>
                            {tier.label}
                          </div>
                          <div className="text-zinc-300 font-mono mt-0.5">
                            {tier.count} ({tier.percent}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/60">
                    💡 <strong>Complexity Note:</strong> {aboutBookData.vocabProfile.details.notes || 'Analyzed against standard frequency and linguistic benchmarks.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-amber-400" />
                      <h4 className="text-sm font-semibold text-zinc-100">
                        Grammar Profile
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="gold">
                        {aboutBookData.grammarProfile.levelLabel}
                      </Badge>
                      <span className="text-sm font-bold text-amber-400">
                        {aboutBookData.grammarProfile.difficultyScore.toFixed(1)} / 10
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400">
                    Scanned {aboutBookData.grammarProfile.totalScannedSentences.toLocaleString()} sentences for discriminating JLPT grammar patterns.
                  </div>

                  {aboutBookData.grammarProfile.detectedPatterns.length > 0 ? (
                    <div>
                      <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 mb-2">
                        Top Detected Grammar Patterns
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {aboutBookData.grammarProfile.detectedPatterns.slice(0, 8).map((p) => (
                          <div
                            key={p.patternId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                          >
                            <span className="text-[10px] font-bold text-amber-400/80 uppercase">
                              {p.level}
                            </span>
                            <span>{p.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ({p.count}×)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No advanced grammar patterns detected yet.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setCardManagerBookId(aboutBookData.book.summary.id);
                        setShowCardManager(true);
                      }}
                    >
                      <Layers size={14} />
                      View Book Cards
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={exportingDeck}
                      loading={exportingDeck}
                      onClick={() => void handleExportBookDeck(aboutBookData.book)}
                    >
                      <Download size={14} />
                      {exportingDeck ? exportProgressText || 'Exporting…' : 'Export Anki Deck'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={closeAboutModal}>
                      Close
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const id = aboutBookData.book.summary.id;
                        closeAboutModal();
                        onNavigate?.('reader', { bookId: id });
                      }}
                    >
                      <BookOpen size={14} />
                      Resume Reading
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <CardManagerModal
        isOpen={showCardManager}
        onClose={() => {
          setShowCardManager(false);
          setCardManagerBookId(undefined);
        }}
        initialBookId={cardManagerBookId}
      />
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-600">
          {label}
        </div>
        <div className="text-lg font-semibold text-zinc-100 mt-0.5">
          {value}
        </div>
      </div>
    </div>
  </Card>
);

const PracticeCard: React.FC<{
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  onClick: () => void;
}> = ({ label, title, description, icon, action, onClick }) => (
  <Card className="p-5 flex flex-col justify-between min-h-[180px]">
    <div>
      <div className="flex items-center gap-2 text-amber-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <h3 className="text-base font-semibold text-zinc-100 mt-4">
        {title}
      </h3>
      <p className="text-xs text-zinc-600 leading-relaxed mt-1.5">
        {description}
      </p>
    </div>
    <div className="mt-5">
      <Button variant="secondary" size="sm" onClick={onClick}>
        {action}
      </Button>
    </div>
  </Card>
);

const BookCard: React.FC<{
  book: BookSummary;
  onOpen: () => void;
  onDelete: (event: React.MouseEvent) => void;
  onStatusChange: (status: BookStatus) => void;
  onAbout: (event: React.MouseEvent) => void;
}> = ({ book, onOpen, onDelete, onStatusChange, onAbout }) => {
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900/40 hover:border-amber-400/40 hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/20 flex items-center justify-center">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <Book size={36} className="text-amber-400/25" />
        )}

        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAbout(event);
            }}
            className="p-1.5 rounded-md bg-zinc-950/80 text-zinc-400 hover:text-amber-400 transition-all"
            title="About this book"
          >
            <MoreVertical size={13} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md bg-zinc-950/80 text-zinc-500 hover:text-rose-300 transition-all"
            title="Remove book"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="absolute bottom-2 left-2">
          <Badge variant="gold">
            {book.language === 'japanese' ? 'JP' : 'EN'}
          </Badge>
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-1">
          <h3
            className="text-xs font-semibold text-zinc-100 truncate flex-1"
            title={book.title}
          >
            {book.title}
          </h3>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAbout(event);
            }}
            className="text-zinc-500 hover:text-amber-400 transition-colors p-0.5 shrink-0"
            title="About this book"
          >
            <MoreVertical size={13} />
          </button>
        </div>

        <div
          className="relative mt-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setStatusOpen((value) => !value)}
            className="w-full text-left text-[10px] px-2 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-400"
          >
            {book.status === 'learning'
              ? 'Learning'
              : book.status === 'on_hold'
                ? 'On Hold'
                : 'Completed'}
          </button>

          {statusOpen && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
              {(['learning', 'on_hold', 'completed'] as BookStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusOpen(false);
                      onStatusChange(status);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-300 hover:bg-zinc-800"
                  >
                    {status === 'learning'
                      ? 'Learning'
                      : status === 'on_hold'
                        ? 'On Hold'
                        : 'Completed'}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
            <span>Mastery</span>
            <span className="text-emerald-400">
              {book.mastery}%
            </span>
          </div>

          <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, book.mastery))}%`,
              }}
            />
          </div>
        </div>

        {!book.backendId && (
          <div className="mt-2 text-[9px] text-zinc-600">
            Local — sync pending
          </div>
        )}
      </div>
    </div>
  );
};
