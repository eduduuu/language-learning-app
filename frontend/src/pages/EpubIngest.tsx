import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle,
  BarChart2,
  Book,
  BookOpen,
  CheckCircle2,
  FileText,
  Sparkles,
  Trash2,
  Upload,
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
  LoadingState,
  PageHeader,
  Segmented,
  Skeleton,
} from '../components/ui';

interface SavedBook {
  id: string;
  user_id: string;
  title: string;
  language: string;
  cover_url?: string;
  created_at: string;
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

export const EpubIngest: React.FC = () => {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchingBooks, setFetchingBooks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [analysis, setAnalysis] = useState<EPUBAnalyzeResponse | null>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setFetchingBooks(true);
    try {
      const res = await api.get('/epub/books', {
        headers: { 'x-user-id': user?.id },
      });
      setBooks(res.data);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setFetchingBooks(false);
    }
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

  const handleSubmit = async (e: FormEvent) => {
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
      setSuccess(
        `"${res.data.title}" added — ${res.data.total_words_extracted} words extracted.`,
      );
      setFile(null);
      setTitle('');
      setStartPage(1);
      setEndPage(10);
      setAnalysis(null);
      fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process EPUB.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
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

  return (
    <div className="space-y-10 max-w-7xl">
      <PageHeader
        icon={BookOpen}
        kicker="Library"
        title="Build your personal reading corpus"
        subtitle="Upload EPUBs to extract vocabulary, measure comprehension, and generate study material tailored to the books you actually want to read."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-5">
          <Card className="sticky top-6">
            <CardHeader
              icon={Upload}
              title="Upload new book"
              subtitle="EPUB format, up to ~50MB"
            />
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{success}</span>
                </div>
              )}

              <label className="block">
                <div
                  className={`relative border border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    file
                      ? 'border-amber-400/40 bg-amber-400/[0.03]'
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-950/40'
                  }`}
                >
                  <input
                    type="file"
                    accept=".epub"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2.5">
                    <div
                      className={`grid place-items-center w-12 h-12 rounded-xl transition-colors ${
                        file
                          ? 'bg-amber-400/15 text-amber-400'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                      }`}
                    >
                      {file ? <FileText size={20} /> : <BookOpen size={20} />}
                    </div>
                    {file ? (
                      <>
                        <span className="text-xs font-medium text-zinc-100 truncate max-w-full px-3">
                          {file.name}
                        </span>
                        <span className="text-[10.5px] text-zinc-500">
                          Click to replace
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-zinc-300">
                          Drop your EPUB here
                        </span>
                        <span className="text-[10.5px] text-zinc-500">
                          or click to browse
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </label>

              <div>
                <Label>Title</Label>
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
                  <Label>Start page</Label>
                  <Input
                    type="number"
                    min={1}
                    value={startPage}
                    onChange={(e) => {
                      setStartPage(parseInt(e.target.value) || 1);
                      setAnalysis(null);
                    }}
                  />
                </div>
                <div>
                  <Label>End page</Label>
                  <Input
                    type="number"
                    min={1}
                    value={endPage}
                    onChange={(e) => {
                      setEndPage(parseInt(e.target.value) || 1);
                      setAnalysis(null);
                    }}
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={!file}
                loading={analyzing}
                variant="secondary"
                fullWidth
              >
                {!analyzing && <BarChart2 size={15} />}
                {analyzing ? 'Analyzing…' : 'Preview comprehension'}
              </Button>

              {analysis && (
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Comprehension preview
                    </span>
                    <Badge variant="muted">Not saved</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 mb-1">Full book</div>
                      <div className="font-display text-2xl text-emerald-400 tabular-nums leading-none">
                        {analysis.full_book_stats.percentage}%
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1.5 tabular-nums">
                        {analysis.full_book_stats.known_words} / {analysis.full_book_stats.total_unique_words} known
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 mb-1">
                        Pages {startPage}–{endPage}
                      </div>
                      <div className="font-display text-2xl text-amber-400 tabular-nums leading-none">
                        {analysis.range_stats.percentage}%
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1.5 tabular-nums">
                        {analysis.range_stats.known_words} / {analysis.range_stats.total_unique_words} known
                      </div>
                    </div>
                  </div>
                  {analysis.full_book_stats.percentage >= 90 && (
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      💡 You already know over 90% of this book — a great candidate for
                      extensive reading practice.
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={!file || !title}
                loading={loading}
                fullWidth
                size="lg"
              >
                {!loading && <Sparkles size={16} />}
                {loading ? 'Processing…' : 'Add to library'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Library grid */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-zinc-100">Your library</h2>
            <Badge variant="muted">
              {books.length} {books.length === 1 ? 'book' : 'books'}
            </Badge>
          </div>

          {fetchingBooks ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3.4]" />
              ))}
            </div>
          ) : books.length === 0 ? (
            <EmptyState
              icon={Book}
              title="Your library is empty"
              description="Upload your first EPUB to start building a personalized vocabulary corpus."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="group relative flex flex-col rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]"
                >
                  <div className="relative aspect-[2/3] bg-zinc-950 overflow-hidden">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt={b.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/30 flex flex-col items-center justify-center p-4 text-center">
                        <Book size={28} className="text-amber-400/50 mb-2" />
                        <span className="text-[11px] font-medium text-zinc-300 line-clamp-3 leading-snug">
                          {b.title}
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <button
                      onClick={() => handleDeleteBook(b.id)}
                      title="Delete"
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-950/80 backdrop-blur text-zinc-400 hover:text-rose-300 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>

                    <span className="absolute bottom-2 left-2 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-950/80 backdrop-blur text-amber-300/90 border border-amber-400/20">
                      {b.language === 'japanese' ? 'JP' : 'EN'}
                    </span>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <h3
                      className="text-xs font-medium text-zinc-200 truncate"
                      title={b.title}
                    >
                      {b.title}
                    </h3>
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Mastery</span>
                        <span className="font-mono text-emerald-400">85%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                          style={{ width: '85%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};