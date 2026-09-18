import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Upload, Book, Trash2, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface SavedBook {
  id: string;
  user_id: string;
  title: string;
  language: string;
  created_at: string;
}

export const EpubIngest: React.FC = () => {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'japanese' | 'english'>('japanese');
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(10);
  
  const [loading, setLoading] = useState(false);
  const [fetchingBooks, setFetchingBooks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [books, setBooks] = useState<SavedBook[]>([]);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setFetchingBooks(true);
    try {
      const res = await api.get('/epub/books', {
        params: { 
          user_id: user?.id || '00000000-0000-0000-0000-000000000000' 
        }
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
      setError(null);
      if (!title) {
        // Auto-fill title from filename
        setTitle(selectedFile.name.replace('.epub', ''));
      }
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
    formData.append('user_id', user?.id || '00000000-0000-0000-0000-000000000000'); // <--- Include user_id in uploads too

    try {
      const res = await api.post('/epub/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(
        `Successfully processed "${res.data.title}"! Extracted ${res.data.total_words_extracted} words across ${res.data.pages_processed} pages.`
      );
      
      setFile(null);
      setTitle('');
      setStartPage(1);
      setEndPage(10);
      
      fetchBooks();
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to process EPUB. Check your parameters.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;

    try {
      await api.delete(`/epub/books/${bookId}`);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err: any) {
      alert('Failed to delete book.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Consume EPUB</h2>
        <p className="text-slate-400 text-sm mt-1">
          Upload EPUB documents to extract vocabulary and power your custom AI study sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Form (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Notifications */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-sm">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                EPUB File
              </label>
              <div className="relative border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-6 text-center transition-colors bg-slate-900/50">
                <input
                  type="file"
                  accept=".epub"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload size={32} className="text-indigo-400" />
                  {file ? (
                    <span className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                      <FileText size={16} /> {file.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm text-slate-300 font-medium">
                        Click or drag & drop EPUB file here
                      </span>
                      <span className="text-xs text-slate-500">Only .epub format supported</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Book Title Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Book Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kokoro / Harry Potter"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Target Language
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLanguage('japanese')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    language === 'japanese'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🇯🇵 Japanese
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('english')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    language === 'english'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🇺🇸 English
                </button>
              </div>
            </div>

            {/* Page Range Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Start Page
                </label>
                <input
                  type="number"
                  min={1}
                  value={startPage}
                  onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  End Page
                </label>
                <input
                  type="number"
                  min={1}
                  value={endPage}
                  onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Extracting Vocabulary...
                </>
              ) : (
                'Process & Save Book'
              )}
            </button>
          </form>
        </div>

        {/* Library List (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-200 text-base flex items-center gap-2">
              <Book size={18} className="text-indigo-400" />
              Saved Library
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {books.length} {books.length === 1 ? 'Book' : 'Books'}
            </span>
          </div>

          {fetchingBooks ? (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : books.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Book size={36} className="mb-2 opacity-50" />
              <p className="text-sm">No books uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px] pr-1">
              {books.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg hover:border-slate-600 transition-colors"
                >
                  <div className="truncate mr-3">
                    <p className="text-sm font-medium text-slate-200 truncate">{b.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {b.language}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBook(b.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Delete book"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};