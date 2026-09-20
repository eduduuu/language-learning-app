import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Trash2,
  Brain,
  BookOpen,
  Layers,
  AlertCircle,
} from 'lucide-react';
import {
  getSRSCards,
  updateSRSCard,
  deleteSRSCard,
  bulkSRSCardAction,
  importAnkiCardsApi,
  type SRSCard,
} from '../../lib/api';
import { listLocalBooks, getLocalBook } from '../../lib/localBookStore';
import { formatCardsToAnkiTsv, downloadFile } from '../../lib/anki/exporter';
import { parseAnkiFileContent, type ParsedAnkiCard } from '../../lib/anki/importer';
import { Badge, Button, Input } from '../ui';

interface CardManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookId?: string;
}

const STATE_CONFIG: Record<
  number,
  { label: string; badgeVariant: 'default' | 'gold' | 'success' | 'muted' }
> = {
  0: { label: 'New', badgeVariant: 'muted' },
  1: { label: 'Learning', badgeVariant: 'gold' },
  2: { label: 'Mastered', badgeVariant: 'success' },
  3: { label: 'Relearning', badgeVariant: 'muted' },
};

export const CardManagerModal: React.FC<CardManagerModalProps> = ({
  isOpen,
  onClose,
  initialBookId,
}) => {
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '0' | '1' | '2' | '3'>('all');
  const [selectedBookId, setSelectedBookId] = useState<string>(initialBookId || 'all');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  const [localBooks, setLocalBooks] = useState<Array<{ id: string; title: string }>>([]);
  const [bookWordsMap, setBookWordsMap] = useState<Map<string, Set<string>>>(new Map());

  // Reschedule state
  const [rescheduleWord, setRescheduleWord] = useState<string | null>(null);
  const [customDueDate, setCustomDueDate] = useState<string>('');

  // Anki Import modal state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importProgressOption, setImportProgressOption] = useState(true);
  const [parsedImportCards, setParsedImportCards] = useState<ParsedAnkiCard[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Anki Export modal state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportWithProgress, setExportWithProgress] = useState(true);

  // Load cards & local books
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [cardsData, booksList] = await Promise.all([
          getSRSCards('japanese'),
          listLocalBooks(),
        ]);

        if (!mounted) return;

        setCards(cardsData);
        setLocalBooks(booksList);

        // Build word sets for each book
        const wordsMap = new Map<string, Set<string>>();
        for (const b of booksList) {
          try {
            const fullBook = await getLocalBook(b.id);
            if (fullBook) {
              const wordSet = new Set<string>();
              for (const ch of fullBook.chapters) {
                for (const p of ch.paragraphs) {
                  for (const s of p.sentences) {
                    for (const t of s.tokens) {
                      if (t.isWordLike === false) continue;
                      const w = t.lemma?.trim() || t.surface?.trim();
                      if (w) wordSet.add(w);
                    }
                  }
                }
              }
              wordsMap.set(b.id, wordSet);
            }
          } catch {
            // Ignore single book load error
          }
        }

        if (mounted) {
          setBookWordsMap(wordsMap);
        }
      } catch (err) {
        console.error('Failed to load card manager data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (initialBookId) {
      setSelectedBookId(initialBookId);
    }
  }, [initialBookId]);

  // Filter cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!card.word.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        const s = parseInt(statusFilter, 10);
        if (card.state !== s) {
          return false;
        }
      }

      // Book
      if (selectedBookId !== 'all') {
        const bookWords = bookWordsMap.get(selectedBookId);
        if (bookWords && !bookWords.has(card.word)) {
          return false;
        }
      }

      return true;
    });
  }, [cards, searchQuery, statusFilter, selectedBookId, bookWordsMap]);

  // Selection helpers
  const handleSelectAll = () => {
    if (selectedWords.size === filteredCards.length) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(filteredCards.map((c) => c.word)));
    }
  };

  const toggleSelectWord = (word: string) => {
    const next = new Set(selectedWords);
    if (next.has(word)) {
      next.delete(word);
    } else {
      next.add(word);
    }
    setSelectedWords(next);
  };

  // Card action handlers
  const handleMarkAsNew = async (word: string) => {
    try {
      const updated = await updateSRSCard(word, {
        state: 0,
        reps: 0,
        difficulty: 0,
        stability: 0,
        lapses: 0,
        next_review_date: new Date().toISOString(),
      });
      setCards((prev) => prev.map((c) => (c.word === word ? updated : c)));
    } catch {
      alert('Failed to reset card to New.');
    }
  };

  const handleMarkAsMastered = async (word: string) => {
    try {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 30);

      const updated = await updateSRSCard(word, {
        state: 2,
        reps: 3,
        stability: 30,
        next_review_date: nextDue.toISOString(),
      });
      setCards((prev) => prev.map((c) => (c.word === word ? updated : c)));
    } catch {
      alert('Failed to mark card as Mastered.');
    }
  };

  const handleReschedule = async (word: string, daysFromNow: number) => {
    try {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + daysFromNow);

      const updated = await updateSRSCard(word, {
        next_review_date: nextDue.toISOString(),
      });
      setCards((prev) => prev.map((c) => (c.word === word ? updated : c)));
      setRescheduleWord(null);
    } catch {
      alert('Failed to reschedule card.');
    }
  };

  const handleCustomReschedule = async (word: string) => {
    if (!customDueDate) return;
    try {
      const updated = await updateSRSCard(word, {
        next_review_date: new Date(customDueDate).toISOString(),
      });
      setCards((prev) => prev.map((c) => (c.word === word ? updated : c)));
      setRescheduleWord(null);
      setCustomDueDate('');
    } catch {
      alert('Failed to reschedule card.');
    }
  };

  const handleDelete = async (word: string) => {
    if (!window.confirm(`Delete "${word}" from your SRS vocabulary?`)) return;
    try {
      await deleteSRSCard(word);
      setCards((prev) => prev.filter((c) => c.word !== word));
      selectedWords.delete(word);
      setSelectedWords(new Set(selectedWords));
    } catch {
      alert('Failed to delete card.');
    }
  };

  // Bulk actions
  const handleBulkAction = async (
    action: 'mark_new' | 'mark_mastered' | 'reschedule' | 'delete',
    days = 1
  ) => {
    const words = Array.from(selectedWords);
    if (!words.length) return;

    if (action === 'delete') {
      if (!window.confirm(`Delete ${words.length} selected cards from your SRS?`)) {
        return;
      }
    }

    try {
      let targetDate: string | undefined;
      if (action === 'reschedule') {
        const d = new Date();
        d.setDate(d.getDate() + days);
        targetDate = d.toISOString();
      }

      await bulkSRSCardAction({
        words,
        action,
        target_date: targetDate,
      });

      // Reload cards
      const fresh = await getSRSCards('japanese');
      setCards(fresh);
      setSelectedWords(new Set());
    } catch {
      alert('Failed to execute bulk action.');
    }
  };

  // Export to Anki
  const handleExportFiltered = () => {
    const cardsToExport =
      selectedWords.size > 0
        ? cards.filter((c) => selectedWords.has(c.word))
        : filteredCards;

    const book = localBooks.find((b) => b.id === selectedBookId);
    const deckName = book ? book.title : 'My Japanese SRS';

    const tsv = formatCardsToAnkiTsv(cardsToExport, {
      withProgress: exportWithProgress,
      deckName,
    });

    const filename = `${deckName.replace(/\s+/g, '_')}_anki_${
      exportWithProgress ? 'progress' : 'clean'
    }.tsv`;

    downloadFile(filename, tsv);
    setShowExportDialog(false);
  };

  // Import from Anki
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const parsed = parseAnkiFileContent(content);
      setParsedImportCards(parsed.cards);
      setImportProgressOption(parsed.hasProgressColumns);
      setShowImportDialog(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!parsedImportCards.length) return;
    setImporting(true);
    setImportFeedback(null);

    try {
      const res = await importAnkiCardsApi({
        cards: parsedImportCards,
        import_progress: importProgressOption,
      });

      setImportFeedback(`Successfully imported ${res.imported_count} cards!`);
      const fresh = await getSRSCards('japanese');
      setCards(fresh);

      setTimeout(() => {
        setShowImportDialog(false);
        setImportFeedback(null);
        setParsedImportCards([]);
      }, 1500);
    } catch {
      setImportFeedback('Failed to import Anki cards. Check file format.');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl h-[92vh] sm:h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800/80 bg-zinc-900/90">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                Deck & Card Manager
                <Badge variant="muted" className="hidden sm:inline-flex">{cards.length} cards</Badge>
              </h2>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Inspect, reschedule, and manage repetitions across all your books and decks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.tsv,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 bg-zinc-800/60 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all">
                <Upload size={14} />
                <span className="hidden sm:inline">Import Anki</span>
              </span>
            </label>

            <button
              onClick={() => setShowExportDialog(true)}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 bg-zinc-800/60 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export Anki</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-zinc-800/60 bg-zinc-950/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards by word…"
              className="pl-9 h-9 text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Book Filter */}
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 min-w-0">
              <BookOpen size={14} className="text-zinc-500 shrink-0" />
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full sm:w-auto h-9 px-2 sm:px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-400/40 truncate"
              >
                <option value="all">All Decks & Books</option>
                {localBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    Book: {b.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 min-w-0">
              <Filter size={14} className="text-zinc-500 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-auto h-9 px-2 sm:px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-400/40"
              >
                <option value="all">All Statuses</option>
                <option value="0">New (0)</option>
                <option value="1">Learning (1)</option>
                <option value="2">Mastered (2)</option>
                <option value="3">Relearning (3)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar (when cards selected) */}
        {selectedWords.size > 0 && (
          <div className="px-6 py-2.5 bg-amber-400/10 border-b border-amber-400/20 flex items-center justify-between animate-fade-in text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-medium">
              <span>{selectedWords.size} selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('mark_new')}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all flex items-center gap-1"
              >
                <RotateCcw size={12} />
                Mark as New
              </button>
              <button
                onClick={() => handleBulkAction('mark_mastered')}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 transition-all flex items-center gap-1"
              >
                <CheckCircle2 size={12} />
                Mark as Mastered
              </button>
              <button
                onClick={() => handleBulkAction('reschedule', 7)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sky-300 transition-all flex items-center gap-1"
              >
                <Calendar size={12} />
                +7 Days
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-all flex items-center gap-1"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Cards Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid place-items-center h-full text-zinc-500 text-sm">
              Loading cards…
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="grid place-items-center h-full text-zinc-500 text-sm p-8 text-center">
              No cards found matching your search or filters.
            </div>
          ) : (
            <div className="w-full">
              {/* Mobile Stacked Cards List (< sm) */}
              <div className="sm:hidden divide-y divide-zinc-800/40">
                <div className="p-3 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedWords.size > 0 &&
                        selectedWords.size === filteredCards.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                    />
                    <span>Select All ({filteredCards.length})</span>
                  </label>
                </div>

                {filteredCards.map((card) => {
                  const stateConf = STATE_CONFIG[card.state] || STATE_CONFIG[0];
                  const isDue = new Date(card.next_review_date) <= new Date();

                  return (
                    <div
                      key={card.word}
                      className="p-3.5 space-y-2.5 hover:bg-zinc-800/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedWords.has(card.word)}
                            onChange={() => toggleSelectWord(card.word)}
                            className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold text-zinc-100 text-sm">
                              {card.word}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant={stateConf.badgeVariant}>
                                {stateConf.label}
                              </Badge>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {card.reps} reps • {Math.round(card.stability)}d
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMarkAsNew(card.word)}
                            title="Reset to New"
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handleMarkAsMastered(card.word)}
                            title="Mark as Mastered"
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <div className="relative inline-block">
                            <button
                              onClick={() =>
                                setRescheduleWord(
                                  rescheduleWord === card.word ? null : card.word
                                )
                              }
                              title="Reschedule next review"
                              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition-colors"
                            >
                              <Calendar size={14} />
                            </button>
                            {rescheduleWord === card.word && (
                              <div className="absolute right-0 top-full mt-1 w-52 p-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-30 space-y-2">
                                <span className="text-[10px] font-semibold uppercase text-zinc-400 block">
                                  Reschedule "{card.word}"
                                </span>
                                <div className="grid grid-cols-3 gap-1">
                                  <button
                                    onClick={() => handleReschedule(card.word, 1)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-200"
                                  >
                                    +1 Day
                                  </button>
                                  <button
                                    onClick={() => handleReschedule(card.word, 7)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-200"
                                  >
                                    +7 Days
                                  </button>
                                  <button
                                    onClick={() => handleReschedule(card.word, 30)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-200"
                                  >
                                    +30 Days
                                  </button>
                                </div>
                                <div className="pt-1 flex gap-1">
                                  <input
                                    type="date"
                                    value={customDueDate}
                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200"
                                  />
                                  <button
                                    onClick={() => handleCustomReschedule(card.word)}
                                    disabled={!customDueDate}
                                    className="px-2 py-1 bg-amber-400/20 text-amber-300 rounded text-[11px] font-medium disabled:opacity-40"
                                  >
                                    Set
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDelete(card.word)}
                            title="Delete card"
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-400 flex items-center justify-between pl-6">
                        <span>Due:</span>
                        <span className={isDue ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                          {new Date(card.next_review_date).toLocaleDateString()} {isDue && '(Due)'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Cards Table (>= sm) */}
              <table className="hidden sm:table w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 z-10">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedWords.size > 0 &&
                        selectedWords.size === filteredCards.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                    />
                  </th>
                  <th className="px-4 py-3">Word</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Reps</th>
                  <th className="px-4 py-3 text-center">Stability</th>
                  <th className="px-4 py-3">Next Due</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-xs">
                {filteredCards.map((card) => {
                  const stateConf = STATE_CONFIG[card.state] || STATE_CONFIG[0];
                  const isDue = new Date(card.next_review_date) <= new Date();

                  return (
                    <tr
                      key={card.word}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedWords.has(card.word)}
                          onChange={() => toggleSelectWord(card.word)}
                          className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                        />
                      </td>

                      <td className="px-4 py-3 font-medium text-zinc-100 text-sm">
                        {card.word}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={stateConf.badgeVariant}>
                          {stateConf.label}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-zinc-400">
                        {card.reps}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-zinc-400">
                        {Math.round(card.stability)}d
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            isDue
                              ? 'text-amber-400 font-medium'
                              : 'text-zinc-400'
                          }
                        >
                          {new Date(card.next_review_date).toLocaleDateString()}
                          {isDue && ' (Due)'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {/* Mark as New */}
                          <button
                            onClick={() => handleMarkAsNew(card.word)}
                            title="Reset to New (state 0)"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            <RotateCcw size={14} />
                          </button>

                          {/* Mark as Mastered */}
                          <button
                            onClick={() => handleMarkAsMastered(card.word)}
                            title="Mark as Mastered (state 2)"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                          >
                            <CheckCircle2 size={14} />
                          </button>

                          {/* Reschedule */}
                          <div className="relative inline-block">
                            <button
                              onClick={() =>
                                setRescheduleWord(
                                  rescheduleWord === card.word ? null : card.word
                                )
                              }
                              title="Reschedule next review"
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition-colors"
                            >
                              <Calendar size={14} />
                            </button>

                            {rescheduleWord === card.word && (
                              <div className="absolute right-0 top-full mt-1 w-52 p-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 space-y-2">
                                <span className="text-[10px] font-semibold uppercase text-zinc-400 block">
                                  Reschedule "{card.word}"
                                </span>
                                <div className="grid grid-cols-3 gap-1">
                                  <button
                                    onClick={() => handleReschedule(card.word, 1)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-200"
                                  >
                                    +1 Day
                                  </button>
                                  <button
                                    onClick={() => handleReschedule(card.word, 7)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-200"
                                  >
                                    +7 Days
                                  </button>
                                  <button
                                    onClick={() => handleReschedule(card.word, 30)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-200"
                                  >
                                    +30 Days
                                  </button>
                                </div>
                                <div className="pt-1 flex gap-1">
                                  <input
                                    type="date"
                                    value={customDueDate}
                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200"
                                  />
                                  <button
                                    onClick={() => handleCustomReschedule(card.word)}
                                    disabled={!customDueDate}
                                    className="px-2 py-1 bg-amber-400/20 text-amber-300 rounded text-[11px] font-medium disabled:opacity-40"
                                  >
                                    Set
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(card.word)}
                            title="Delete card from SRS"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            Showing {filteredCards.length} of {cards.length} cards
          </span>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-500" /> New: {cards.filter((c) => c.state === 0).length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Learning: {cards.filter((c) => c.state === 1).length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Mastered: {cards.filter((c) => c.state === 2).length}
            </span>
          </div>
        </div>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Download size={18} className="text-amber-400" />
                Export to Anki TSV
              </h3>
              <button
                onClick={() => setShowExportDialog(false)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Export {selectedWords.size > 0 ? `${selectedWords.size} selected cards` : `${filteredCards.length} cards`} to an Anki-compatible TSV file.
            </p>

            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportWithProgress}
                  onChange={(e) => setExportWithProgress(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Include SRS Scheduling & Progress
                  </span>
                  <span className="text-[11px] text-zinc-500 block mt-0.5">
                    Exports review state, repetitions, stability, and next due date into Anki columns.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowExportDialog(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleExportFiltered}>
                <Download size={14} />
                Download Deck
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Upload size={18} className="text-amber-400" />
                Import Anki Cards
              </h3>
              <button
                onClick={() => setShowImportDialog(false)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Found {parsedImportCards.length} cards in the uploaded file.
            </p>

            {/* Preview */}
            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg space-y-2">
              <span className="text-[10px] font-semibold uppercase text-zinc-500 block">
                Preview (First 5 Cards)
              </span>
              <div className="space-y-1 max-h-36 overflow-y-auto text-xs">
                {parsedImportCards.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between text-zinc-300">
                    <span className="font-semibold text-amber-300">{c.word}</span>
                    <span className="text-zinc-500 text-[11px] truncate max-w-[240px]">
                      {c.meaning || c.reading || 'No meaning'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importProgressOption}
                  onChange={(e) => setImportProgressOption(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Import SRS Progress
                  </span>
                  <span className="text-[11px] text-zinc-500 block mt-0.5">
                    {importProgressOption
                      ? 'Restores review state, repetitions, and due dates from file.'
                      : 'Imports all words as brand new cards (state 0).'}
                  </span>
                </div>
              </label>
            </div>

            {importFeedback && (
              <div className="p-3 rounded bg-zinc-800 text-xs text-amber-300">
                {importFeedback}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowImportDialog(false)}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                loading={importing}
              >
                Confirm Import ({parsedImportCards.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
