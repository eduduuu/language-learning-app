import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Languages,
  Plus,
  Settings2,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';

import { Badge, Button } from '../components/ui';
import { getLocalBook, touchLocalBook } from '../lib/localBookStore';
import type { LocalBook, LocalChapter, LocalToken } from '../types/book';

interface ReaderProps {
  bookId: string;
  onNavigate: (
    tab: 'home',
    params?: { bookId?: string }
  ) => void;
}

interface WordInfo {
  lemma: string;
  reading: string;
  meaning: string;
  jlpt: string;
  isCard: boolean;
  mastery?: number;
}

const MOCK_DICTIONARY: Record<string, WordInfo> = {
  眺める: {
    lemma: '眺める',
    reading: 'ながめる',
    meaning: 'to gaze at; to look out over',
    jlpt: 'N3',
    isCard: false,
  },
  始まる: {
    lemma: '始まる',
    reading: 'はじまる',
    meaning: 'to begin; to start',
    jlpt: 'N5',
    isCard: true,
    mastery: 82,
  },
  歩く: {
    lemma: '歩く',
    reading: 'あるく',
    meaning: 'to walk',
    jlpt: 'N5',
    isCard: true,
    mastery: 91,
  },
  見つける: {
    lemma: '見つける',
    reading: 'みつける',
    meaning: 'to find; to discover',
    jlpt: 'N4',
    isCard: false,
  },
};

export const Reader: React.FC<ReaderProps> = ({ bookId, onNavigate }) => {
  const [book, setBook] = useState<LocalBook | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<LocalToken | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    getLocalBook(bookId).then(async (result) => {
      if (!mounted || !result) return;

      setBook(result);

      const index = result.chapters.findIndex(
        (chapter) => chapter.id === result.summary.currentChapterId
      );

      setActiveChapterIndex(index >= 0 ? index : 0);
      await touchLocalBook(bookId);
    });

    return () => {
      mounted = false;
    };
  }, [bookId]);

  if (!book || !book.chapters.length) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-sm text-zinc-500">Loading reader…</div>
      </div>
    );
  }

  const activeChapter = book.chapters[activeChapterIndex];

  if (!activeChapter) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-sm text-zinc-500">Chapter not found.</div>
      </div>
    );
  }

  const handleSelectToken = (token: LocalToken) => {
    if (token.isWordLike === false) return;
    setSelectedWord(token);
  };

  const handleAddCard = () => {
    if (!selectedWord) return;

    const key = selectedWord.lemma ?? selectedWord.surface;

    setSavedWords((previous) => {
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  };

  const goToChapter = (index: number) => {
    setSelectedWord(null);
    setActiveChapterIndex(index);
  };

  return (
    <div className="relative min-h-[calc(100vh-5rem)] animate-slide-up">
      <header className="sticky top-0 z-30 -mx-8 lg:-mx-10 px-8 lg:px-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('home')}>
              <ArrowLeft size={15} />
              Library
            </Button>

            <div className="h-5 w-px bg-zinc-800" />

            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-100 truncate">{book.summary.title}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Reading</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="gold">{book.summary.mastery}% mastery</Badge>
            <button
              type="button"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800"
              title="Reader settings"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,760px)_280px] gap-8 py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-600 px-2 mb-3">
              Chapters
            </div>

            <div className="space-y-1">
              {book.chapters.map((chapter, index) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => goToChapter(index)}
                  className={[
                    'w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all',
                    index === activeChapterIndex
                      ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
                  ].join(' ')}
                >
                  <div className="font-medium">{chapter.title}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {chapter.paragraphs.length} sections
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main>
          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold mb-3">
              {activeChapterIndex + 1} / {book.chapters.length}
            </div>

            <h1 className="font-display text-4xl sm:text-5xl text-zinc-50">
              {activeChapter.title}
            </h1>
          </div>

          <article className="space-y-7 text-[18px] sm:text-[19px] leading-[2.15] text-zinc-200">
            {activeChapter.paragraphs.map((paragraph) => (
              <div key={paragraph.id} className="space-y-3">
                {paragraph.sentences.map((sentence) => (
                  <p key={sentence.id}>
                    {sentence.tokens.map((token) => {
                      if (token.isWordLike === false) {
                        return (
                          <React.Fragment key={token.id}>
                            {token.surface}
                          </React.Fragment>
                        );
                      }

                      const lemma = token.lemma ?? token.surface;
                      const isKnown = MOCK_DICTIONARY[lemma]?.isCard;

                      return (
                        <button
                          key={token.id}
                          type="button"
                          onClick={() => handleSelectToken(token)}
                          className={[
                            'rounded-md transition-colors duration-100',
                            'hover:bg-amber-400/10 hover:text-amber-300',
                            isKnown ? 'text-zinc-200' : '',
                          ].join(' ')}
                        >
                          {token.surface}
                        </button>
                      );
                    })}
                  </p>
                ))}
              </div>
            ))}
          </article>

          <div className="mt-14 pt-6 border-t border-zinc-800/70 flex justify-between gap-4">
            <Button
              variant="secondary"
              disabled={activeChapterIndex === 0}
              onClick={() => goToChapter(activeChapterIndex - 1)}
            >
              <ChevronLeft size={15} />
              Previous
            </Button>

            <Button
              disabled={activeChapterIndex === book.chapters.length - 1}
              onClick={() => goToChapter(activeChapterIndex + 1)}
            >
              Next Chapter
              <ChevronRight size={15} />
            </Button>
          </div>
        </main>

        <aside className="lg:block">
          <div className="lg:sticky lg:top-24">
            {!selectedWord ? (
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center mb-4">
                  <Languages size={18} />
                </div>

                <h3 className="text-sm font-semibold text-zinc-100">Explore the text</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                  Click a Japanese word to see its meaning, learning status, and SRS options.
                </p>
              </div>
            ) : (
              <WordPanel
                token={selectedWord}
                isSaved={savedWords.has(selectedWord.lemma ?? selectedWord.surface)}
                onAdd={handleAddCard}
                onClose={() => setSelectedWord(null)}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

interface WordPanelProps {
  token: LocalToken;
  isSaved: boolean;
  onAdd: () => void;
  onClose: () => void;
}

const WordPanel: React.FC<WordPanelProps> = ({ token, isSaved, onAdd, onClose }) => {
  const key = token.lemma ?? token.surface;
  const info = MOCK_DICTIONARY[key];

  const fallback: WordInfo = {
    lemma: key,
    reading: '—',
    meaning: 'Meaning not available in mock dictionary.',
    jlpt: 'Unknown',
    isCard: false,
  };

  const word = info ?? fallback;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/80 overflow-hidden shadow-2xl shadow-black/20">
      <div className="p-5 border-b border-zinc-800/70">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-4xl text-zinc-50">{word.lemma}</div>
            <div className="text-sm text-amber-400 mt-1">{word.reading}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Meaning</div>
          <div className="text-sm text-zinc-200">{word.meaning}</div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="gold">{word.jlpt}</Badge>

          {word.isCard && (
            <Badge variant="success">{word.mastery}% mastered</Badge>
          )}

          {!word.isCard && !isSaved && <Badge variant="muted">Not in SRS</Badge>}

          {isSaved && (
            <Badge variant="success">
              <Check size={10} />
              Added
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 text-xs"
          >
            <Volume2 size={14} />
            Listen
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 text-xs"
          >
            <Sparkles size={14} />
            Explain
          </button>
        </div>

        {!word.isCard && !isSaved ? (
          <Button fullWidth onClick={onAdd}>
            <Plus size={15} />
            Add to SRS
          </Button>
        ) : (
          <Button variant="secondary" fullWidth>
            <BookOpen size={14} />
            View Card
          </Button>
        )}

        <div className="pt-4 border-t border-zinc-800/70 flex items-center justify-between text-[10px] text-zinc-600">
          <span>From this book</span>
          <span className="flex items-center gap-1">
            <Headphones size={10} />
            Local context
          </span>
        </div>
      </div>
    </div>
  );
};
