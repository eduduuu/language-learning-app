import React, { useEffect, useMemo, useState } from 'react';
import {
  Book,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { Badge, Button, Card, Input, PageHeader, Segmented } from '../components/ui';
import {
  createLocalBookFromEpub,
  deleteLocalBook,
  listLocalBooks,
  updateLocalBookStatus,
} from '../lib/localBookStore';
import type { BookLanguage, BookStatus, BookSummary } from '../types/book';

interface HomeDashboardProps {
  onNavigate?: (tab: string, params?: { bookId?: string }) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookStatus>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<BookLanguage>('japanese');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, []);

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
        <StatCard icon={<Flame size={19} />} label="Reading Streak" value="12 days" />
        <StatCard icon={<BookOpen size={19} />} label="Words Mastered" value="1,420" />
        <StatCard icon={<Clock size={19} />} label="Reviews Due" value="24" />
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
                <Book size={28} className="text-amber-400/40" />
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

            <Button
              size="lg"
              onClick={() =>
                onNavigate?.('reader', { bookId: activeBook.id })
              }
            >
              <BookOpen size={16} />
              Continue Reading
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <PracticeCard
          label="Daily Review"
          title="24 cards due"
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
}> = ({ book, onOpen, onDelete, onStatusChange }) => {
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

        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-950/80 text-zinc-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-all"
          title="Remove book"
        >
          <Trash2 size={13} />
        </button>

        <div className="absolute bottom-2 left-2">
          <Badge variant="gold">
            {book.language === 'japanese' ? 'JP' : 'EN'}
          </Badge>
        </div>
      </div>

      <div className="p-3.5">
        <h3
          className="text-xs font-semibold text-zinc-100 truncate"
          title={book.title}
        >
          {book.title}
        </h3>

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
