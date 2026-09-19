import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle,
  BarChart2,
  Book,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Segmented,
  Skeleton,
} from '../components/ui';

export type BookStatus = 'learning' | 'on_hold' | 'completed';

export interface SavedBook {
  id: string;
  user_id: string;
  title: string;
  language: string;
  cover_url?: string;
  created_at: string;
  // Enhanced local/mock fields
  status?: BookStatus;
  mastery?: number;
  known_words?: number;
  total_words?: number;
}

interface ComprehensionStats {
  total_unique_words: number;
  known_words: number;
  percentage: number;
}

interface EPUBAnalyzeResponse {
  total_range_words: number;
  total_book_words: number;
  full_book_stats: ComprehensionStats;
  range_stats: ComprehensionStats;
}

interface HomeDashboardProps {
  onNavigate?: (tab: string, params?: { bookId?: string }) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Books State
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [fetchingBooks, setFetchingBooks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | BookStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer / Upload Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EPUBAnalyzeResponse | null>(null);

  // Status dropdown menu state for individual book cards
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setFetchingBooks(true);
    try {
      const res = await api.get('/epub/books', {
        headers: { 'x-user-id': user?.id },
      });
      
      // Merge with default mock metadata for status and mastery
      const enrichedBooks: SavedBook[] = res.data.map((b: SavedBook, idx: number) => ({
        ...b,
        status: b.status || (idx === 0 ? 'learning' : idx === 1 ? 'on_hold' : 'completed'),
        mastery: b.mastery || Math.floor(60 + Math.random() * 35),
        known_words: b.known_words || 1420 + idx * 300,
        total_words: b.total_words || 2100 + idx * 400,
      }));

      setBooks(enrichedBooks);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setFetchingBooks(false);
    }
  };

  const handleUpdateBookStatus = (bookId: string, newStatus: BookStatus) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === bookId ? { ...b, status: newStatus } : b))
    );
    setOpenStatusMenuId(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith('.epub')) {
      setError('Please select a valid .epub file.');
      return;
    }
    setFile(selected);
    setAnalysis(null);
    setError(null);
    if (!title) setTitle(selected.name.replace('.epub', ''));
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    formData.append('start_page', startPage.toString());
    formData.append('end_page', endPage.toString());

    try {
      const res = await api.post<EPUBAnalyzeResponse>('/epub/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-user-id': user?.id,
        },
      });
      setAnalysis(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to analyze EPUB.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('language', language);
    formData.append('start_page', startPage.toString());
    formData.append('end_page', endPage.toString());

    try {
      const res = await api.post('/epub/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-user-id': user?.id,
        },
      });

      setSuccess(`"${res.data.title}" added to library!`);
      setFile(null);
      setTitle('');
      setStartPage(1);
      setEndPage(10);
      setAnalysis(null);
      
      await fetchBooks();
      setTimeout(() => {
        setIsDrawerOpen(false);
        setSuccess(null);
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process EPUB.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this book from your library?')) return;
    try {
      await api.delete(`/epub/books/${bookId}`, {
        headers: { 'x-user-id': user?.id },
      });
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch {
      alert('Failed to delete book.');
    }
  };

  const filteredBooks = books.filter((b) => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const activeBook = books.find((b) => b.status === 'learning') || books[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Add Button */}
      <PageHeader
        icon={BookOpen}
        kicker="Dashboard"
        title="Welcome back, Reader"
        subtitle="Track your reading progress, review vocabulary SRS cards, and expand your language corpus."
        action={
          <Button onClick={() => setIsDrawerOpen(true)} size="lg">
            <Plus size={16} /> Add New EPUB
          </Button>
        }
      />

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
            <Flame size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Reading Streak
            </div>
            <div className="text-xl font-bold text-zinc-100 tabular-nums">12 Days</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Brain size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Words Mastered
            </div>
            <div className="text-xl font-bold text-zinc-100 tabular-nums">1,420</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <RotateCcw size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              SRS Queue Due
            </div>
            <div className="text-xl font-bold text-amber-400 tabular-nums">24 Cards</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700/80">
            <Book size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Active Books
            </div>
            <div className="text-xl font-bold text-zinc-100 tabular-nums">
              {books.filter((b) => b.status === 'learning').length} Books
            </div>
          </div>
        </Card>
      </div>

      {/* Hero Daily Focus Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SRS Review Action */}
        <Card className="p-6 relative overflow-hidden flex flex-col justify-between border-amber-400/20 bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-amber-950/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="gold">Daily Retention</Badge>
              <Clock size={14} className="text-zinc-500" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">SRS Flashcard Review</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              You have <strong className="text-amber-400">24 cards</strong> ready for review today across your active books.
            </p>
          </div>
          <div className="mt-6">
            <Button
              onClick={() => onNavigate?.('vocab')}
              fullWidth
              className="shadow-lg shadow-amber-400/10"
            >
              <Brain size={15} /> Start Review Queue
            </Button>
          </div>
        </Card>

        {/* Continue Reading Widget */}
        <Card className="p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="default">Continue Reading</Badge>
              <span className="text-[11px] text-zinc-500">Last active</span>
            </div>
            {activeBook ? (
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-16 rounded-md bg-zinc-950 border border-zinc-800 shrink-0 overflow-hidden">
                  {activeBook.cover_url ? (
                    <img src={activeBook.cover_url} alt={activeBook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-400/40">
                      <Book size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-100 truncate">{activeBook.title}</h4>
                  <div className="text-[11px] text-zinc-500 mt-1 font-mono">
                    {activeBook.known_words} / {activeBook.total_words} words ({activeBook.mastery}%)
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No active book in progress.</p>
            )}
          </div>
          <div className="mt-6">
            <Button
              variant="secondary"
              fullWidth
              disabled={!activeBook}
              onClick={() => activeBook && onNavigate?.('vocab', { bookId: activeBook.id })}
            >
              <Play size={14} /> Open Book Vocabulary
            </Button>
          </div>
        </Card>

        {/* Suggested Quiz Widget */}
        <Card className="p-6 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="success">Suggested Practice</Badge>
              <Sparkles size={14} className="text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Weak Words Quiz</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Target 10 Japanese verbs you recently marked as difficult in your last reading session.
            </p>
          </div>
          <div className="mt-6">
            <Button variant="secondary" fullWidth onClick={() => onNavigate?.('quiz')}>
              <HelpCircle size={15} /> Take Quick Quiz
            </Button>
          </div>
        </Card>
      </div>

      {/* Main Library Stage */}
      <div className="space-y-5 pt-4">
        {/* Header, Search & Status Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-zinc-100">My Library</h2>
            <Badge variant="muted">{filteredBooks.length} Books</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <Input
              placeholder="Search books…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 text-xs"
            />

            {/* Filter Pills */}
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as any)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'learning', label: 'Learning' },
                { value: 'on_hold', label: 'On Hold' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        </div>

        {/* Books Grid */}
        {fetchingBooks ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3.4]" />
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            icon={Book}
            title="No books found"
            description={
              searchQuery
                ? `No books matching "${searchQuery}"`
                : 'Upload an EPUB file to populate your collection.'
            }
            action={
              <Button onClick={() => setIsDrawerOpen(true)}>
                <Plus size={14} /> Add EPUB
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {filteredBooks.map((b) => {
              const isMenuOpen = openStatusMenuId === b.id;

              return (
                <div
                  key={b.id}
                  onClick={() => onNavigate?.('vocab', { bookId: b.id })}
                  className="group relative flex flex-col rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900/40 hover:border-amber-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-400/5 cursor-pointer"
                >
                  {/* Book Cover Image */}
                  <div className="relative aspect-[2/3] bg-zinc-950 overflow-hidden">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt={b.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/20 flex flex-col items-center justify-center p-4 text-center">
                        <Book size={32} className="text-amber-400/40 mb-2" />
                        <span className="text-xs font-semibold text-zinc-300 line-clamp-3">
                          {b.title}
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                    {/* Language Badge */}
                    <span className="absolute bottom-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-950/90 text-amber-300 border border-amber-400/30 backdrop-blur">
                      {b.language === 'japanese' ? 'JP' : 'EN'}
                    </span>

                    {/* Delete Action */}
                    <button
                      onClick={(e) => handleDeleteBook(b.id, e)}
                      title="Delete book"
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-950/80 text-zinc-400 hover:text-rose-300 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-all backdrop-blur"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Book Card Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between bg-zinc-900/60">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-100 truncate" title={b.title}>
                        {b.title}
                      </h3>

                      {/* Status Selector Dropdown */}
                      <div className="relative mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setOpenStatusMenuId(isMenuOpen ? null : b.id)}
                          className="w-full flex items-center justify-between text-[10px] font-medium px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                        >
                          <span className="flex items-center gap-1.5 capitalize">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                b.status === 'learning'
                                  ? 'bg-emerald-400'
                                  : b.status === 'on_hold'
                                  ? 'bg-amber-400'
                                  : 'bg-indigo-400'
                              }`}
                            />
                            {b.status === 'learning'
                              ? 'Learning'
                              : b.status === 'on_hold'
                              ? 'On Hold'
                              : 'Completed'}
                          </span>
                          <ChevronDown size={12} className="text-zinc-500" />
                        </button>

                        {/* Status Menu Popup */}
                        {isMenuOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden py-1">
                            <button
                              onClick={() => handleUpdateBookStatus(b.id, 'learning')}
                              className="w-full text-left px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Learning
                            </button>
                            <button
                              onClick={() => handleUpdateBookStatus(b.id, 'on_hold')}
                              className="w-full text-left px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              On Hold
                            </button>
                            <button
                              onClick={() => handleUpdateBookStatus(b.id, 'completed')}
                              className="w-full text-left px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              Completed
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mastery Bar */}
                    <div className="mt-3 pt-2 border-t border-zinc-800/60">
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                        <span>Mastery</span>
                        <span className="font-mono text-emerald-400">{b.mastery}%</span>
                      </div>
                      <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                          style={{ width: `${b.mastery}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Drawer for Adding EPUB */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800/80 h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid place-items-center w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/20">
                    <Upload size={16} />
                  </div>
                  <h3 className="font-semibold text-zinc-100 text-sm">Add New EPUB</h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-900"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Upload Form */}
              <form id="epub-upload-form" onSubmit={handleUploadSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                {/* Dropzone */}
                <label className="block">
                  <div
                    className={`relative border border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
                      file
                        ? 'border-amber-400/40 bg-amber-400/[0.03]'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".epub"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen size={24} className={file ? 'text-amber-400' : 'text-zinc-500'} />
                      {file ? (
                        <span className="text-xs font-medium text-zinc-200 truncate max-w-full">
                          {file.name}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          Click or drag EPUB file here
                        </span>
                      )}
                    </div>
                  </div>
                </label>

                <div>
                  <Label>Book Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Kokoro"
                    required
                  />
                </div>

                <div>
                  <Label>Language</Label>
                  <Segmented
                    value={language}
                    onChange={(v) => {
                      setLanguage(v);
                      setAnalysis(null);
                    }}
                    className="w-full"
                    options={[
                      { value: 'japanese', label: '🇯🇵 Japanese' },
                      { value: 'english', label: '🇺🇸 English' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Page</Label>
                    <Input
                      type="number"
                      min={1}
                      value={startPage}
                      onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label>End Page</Label>
                    <Input
                      type="number"
                      min={1}
                      value={endPage}
                      onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                {/* Analyze Button */}
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!file}
                  loading={analyzing}
                  variant="secondary"
                  fullWidth
                >
                  {!analyzing && <BarChart2 size={14} />}
                  {analyzing ? 'Analyzing…' : 'Preview Comprehension'}
                </Button>

                {/* Analysis Preview Cards */}
                {analysis && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Comprehension Stats
                      </span>
                      <Badge variant="muted">Preview</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                        <div className="text-[10px] text-zinc-500">Full Book</div>
                        <div className="font-display text-xl text-emerald-400">
                          {analysis.full_book_stats.percentage}%
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          {analysis.full_book_stats.known_words}/{analysis.full_book_stats.total_unique_words} words
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                        <div className="text-[10px] text-zinc-500">
                          Pages {startPage}–{endPage}
                        </div>
                        <div className="font-display text-xl text-amber-400">
                          {analysis.range_stats.percentage}%
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          {analysis.range_stats.known_words}/{analysis.range_stats.total_unique_words} words
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Bottom Form Submit */}
            <div className="pt-4 border-t border-zinc-800">
              <Button
                type="submit"
                form="epub-upload-form"
                disabled={!file || !title}
                loading={loading}
                fullWidth
                size="lg"
              >
                {!loading && <Sparkles size={16} />}
                {loading ? 'Processing…' : 'Save to Library'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};