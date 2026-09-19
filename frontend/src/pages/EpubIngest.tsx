import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Upload, Book, Trash2, AlertCircle, CheckCircle2, Loader2, FileText, BookOpen, BarChart2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(10);
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchingBooks, setFetchingBooks] = useState(false);
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
        headers: { 'x-user-id': user?.id }
      });
      setBooks(res.data);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setFetchingBooks(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.epub')) {
        setError('Please select a valid .epub file.');
        return;
      }
      setFile(selectedFile);
      setAnalysis(null);
      setError(null);
      if (!title) {
        setTitle(selectedFile.name.replace('.epub', ''));
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select an EPUB file first.');
      return;
    }

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
          'x-user-id': user?.id
        },
      });
      setAnalysis(res.data);
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to analyze EPUB.';
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      setError('Please provide a title and upload an EPUB file.');
      return;
    }

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
          'x-user-id': user?.id
        },
      });

      setSuccess(
        `Successfully processed "${res.data.title}"! Extracted ${res.data.total_words_extracted} words.`
      );
      
      setFile(null);
      setTitle('');
      setStartPage(1);
      setEndPage(10);
      setAnalysis(null);
      
      fetchBooks();
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to process EPUB.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;

    try {
      await api.delete(`/epub/books/${bookId}`, {
        headers: { 'x-user-id': user?.id }
      });
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err: any) {
      alert('Failed to delete book.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Library & Ingestion</h2>
        <p className="text-slate-400 text-sm mt-1">
          Upload EPUBs to generate your personalized vocabulary density library.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Form (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl h-fit">
          <form onSubmit={handleSubmit} className="space-y-5">
            <h3 className="font-bold text-slate-200 text-base flex items-center gap-2">
              <Upload size={18} className="text-indigo-400" /> Upload New EPUB
            </h3>

            {error && (
              <div className="flex items-center gap-3 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <div className="relative border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-5 text-center transition-colors bg-slate-900/50">
                <input
                  type="file"
                  accept=".epub"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <BookOpen size={28} className="text-indigo-400" />
                  {file ? (
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 truncate">
                      <FileText size={14} /> {file.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Click or drag EPUB file here</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kokoro"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Language</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setLanguage('japanese'); setAnalysis(null); }}
                  className={`py-2 rounded-lg text-xs font-medium border ${
                    language === 'japanese' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🇯🇵 Japanese
                </button>
                <button
                  type="button"
                  onClick={() => { setLanguage('english'); setAnalysis(null); }}
                  className={`py-2 rounded-lg text-xs font-medium border ${
                    language === 'english' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🇺🇸 English
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Start Page</label>
                <input
                  type="number"
                  min={1}
                  value={startPage}
                  onChange={(e) => {
                    setStartPage(parseInt(e.target.value) || 1);
                    setAnalysis(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">End Page</label>
                <input
                  type="number"
                  min={1}
                  value={endPage}
                  onChange={(e) => {
                    setEndPage(parseInt(e.target.value) || 1);
                    setAnalysis(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Analyze Action Button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || !file}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 py-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-slate-600"
            >
              {analyzing ? (
                <Loader2 size={15} className="animate-spin text-indigo-400" />
              ) : (
                <>
                  <BarChart2 size={15} className="text-indigo-400" />
                  Analyze Comprehension Preview
                </>
              )}
            </button>

            {/* Comprehension Stats Card */}
            {analysis && (
              <div className="p-4 bg-slate-900 border border-indigo-500/40 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Comprehension Preview</h4>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Not Saved</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Full Book</span>
                    <span className="text-xl font-bold text-emerald-400">{analysis.full_book_stats.percentage}%</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {analysis.full_book_stats.known_words} / {analysis.full_book_stats.total_unique_words} known
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Pages {startPage}–{endPage}</span>
                    <span className="text-xl font-bold text-indigo-400">{analysis.range_stats.percentage}%</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {analysis.range_stats.known_words} / {analysis.range_stats.total_unique_words} known
                    </span>
                  </div>
                </div>

                {analysis.full_book_stats.percentage >= 90 && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    💡 You already know over 90% of this book!
                  </p>
                )}
              </div>
            )}

            {/* Final Save Button */}
            <button
              type="submit"
              disabled={loading || !file || !title}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 disabled:text-slate-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & Save to Library'}
            </button>
          </form>
        </div>

        {/* Steam-Style Book Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-200 text-base flex items-center gap-2">
              <Book size={18} className="text-indigo-400" />
              My Steam Library
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {books.length} {books.length === 1 ? 'Book' : 'Books'}
            </span>
          </div>

          {fetchingBooks ? (
            <div className="flex items-center justify-center p-12 text-slate-500">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : books.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500">
              <Book size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Your library is empty.</p>
              <p className="text-xs text-slate-600 mt-1">Upload an EPUB on the left to populate your collection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="group relative bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-xl overflow-hidden transition-all duration-300 shadow-lg hover:shadow-indigo-500/10 flex flex-col"
                >
                  <div className="relative aspect-[2/3] bg-slate-900 overflow-hidden flex items-center justify-center">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt={b.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 text-center">
                        <Book size={32} className="text-indigo-400 mb-2 opacity-60" />
                        <span className="text-xs font-semibold text-slate-300 line-clamp-2">{b.title}</span>
                      </div>
                    )}

                    <button
                      onClick={() => handleDeleteBook(b.id)}
                      className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                      title="Delete Book"
                    >
                      <Trash2 size={14} />
                    </button>

                    <span className="absolute bottom-2 left-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-900/80 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                      {b.language === 'japanese' ? '🇯🇵 JP' : '🇺🇸 EN'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-800 flex-1 flex flex-col justify-between">
                    <h4 className="text-xs font-bold text-slate-200 truncate" title={b.title}>
                      {b.title}
                    </h4>

                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Mastery</span>
                        <span className="font-mono text-emerald-400">85%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '85%' }} />
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