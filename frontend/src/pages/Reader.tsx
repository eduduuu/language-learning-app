import React, { useEffect, useMemo, useState } from 'react';
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
import {
  lookupJapanese,
  type DictionaryEntry,
} from '../lib/dictionary/japanese';
import type { LocalBook, LocalToken } from '../types/book';
import {
  addSRSCard,
  getSRSCards,
  type SRSCard,
} from '../lib/api';

interface ReaderProps {
  bookId: string;
  onNavigate: (
    tab: 'home',
    params?: { bookId?: string }
  ) => void;
}

interface TokenDetails extends LocalToken {
  reading?: string;
  partOfSpeech?: string;
}


export const Reader: React.FC<ReaderProps> = ({
  bookId,
  onNavigate,
}) => {
  const [book, setBook] = useState<LocalBook | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [selectedWord, setSelectedWord] =
    useState<TokenDetails | null>(null);

  const [savedWords, setSavedWords] =
  useState<Set<string>>(new Set());

  const [addingWord, setAddingWord] =
    useState(false);

  useEffect(() => {
  let mounted = true;

  async function loadSRS() {
    try {
      const cards = await getSRSCards('japanese');

      if (!mounted) return;

      setSavedWords(
        new Set(
          cards.map((card) => card.word)
        )
      );
    } catch (error) {
      console.error(
        'Failed to load SRS cards:',
        error
      );
    }
  }

  loadSRS();

  return () => {
    mounted = false;
  };
}, []);


  useEffect(() => {
    let mounted = true;

    getLocalBook(bookId).then(async (result) => {
      if (!mounted || !result) return;

      setBook(result);

      const index = result.chapters.findIndex(
        (chapter) =>
          chapter.id === result.summary.currentChapterId
      );

      setActiveChapterIndex(index >= 0 ? index : 0);

      await touchLocalBook(bookId);
    });

    return () => {
      mounted = false;
    };
  }, [bookId]);

  const activeChapter = useMemo(() => {
    if (!book) return null;

    return (
      book.chapters[activeChapterIndex] ?? null
    );
  }, [book, activeChapterIndex]);

  if (!book || !book.chapters.length) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-sm text-zinc-500">
          Loading reader…
        </div>
      </div>
    );
  }

  if (!activeChapter) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-sm text-zinc-500">
          Chapter not found.
        </div>
      </div>
    );
  }

  const handleSelectToken = (
    token: LocalToken
  ) => {
    if (token.isWordLike === false) return;

    setSelectedWord(token as TokenDetails);
  };

  const handleAddCard = async () => {
    if (!selectedWord || addingWord) {
      return;
    }

    const word =
      selectedWord.lemma ||
      selectedWord.dictionaryForm ||
      selectedWord.surface;

    if (!word.trim()) {
      return;
    }

    try {
      setAddingWord(true);

      const card = await addSRSCard({
        word,
        language: 'japanese',
      });

      setSavedWords((previous) => {
        const next = new Set(previous);
        next.add(card.word);
        return next;
      });

    } catch (error) {
      console.error(
        'Failed to add word to SRS:',
        error
      );

      window.alert(
        'Could not add this word to SRS.'
      );
    } finally {
      setAddingWord(false);
    }
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('home')}
            >
              <ArrowLeft size={15} />
              Library
            </Button>

            <div className="h-5 w-px bg-zinc-800" />

            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-100 truncate">
                {book.summary.title}
              </div>

              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Reading
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="gold">
              {book.summary.mastery}% mastery
            </Badge>

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
                  <div className="font-medium">
                    {chapter.title}
                  </div>

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
              <div
                key={paragraph.id}
                className="space-y-3"
              >
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

                      return (
                        <button
                          key={token.id}
                          type="button"
                          onClick={() =>
                            handleSelectToken(token)
                          }
                          className="rounded-md transition-colors duration-100 hover:bg-amber-400/10 hover:text-amber-300"
                          title={
                            token.lemma &&
                            token.lemma !== token.surface
                              ? `Dictionary form: ${token.lemma}`
                              : undefined
                          }
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
              onClick={() =>
                goToChapter(activeChapterIndex - 1)
              }
            >
              <ChevronLeft size={15} />
              Previous
            </Button>

            <Button
              disabled={
                activeChapterIndex ===
                book.chapters.length - 1
              }
              onClick={() =>
                goToChapter(activeChapterIndex + 1)
              }
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

                <h3 className="text-sm font-semibold text-zinc-100">
                  Explore the text
                </h3>

                <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                  Click a Japanese word to see its dictionary
                  form, reading, meaning, and learning status.
                </p>
              </div>
            ) : (
              <WordPanel
                token={selectedWord}
                isSaved={savedWords.has(
                  selectedWord.lemma ||
                    selectedWord.dictionaryForm ||
                    selectedWord.surface
                )}
                adding={addingWord}
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
  token: TokenDetails;
  isSaved: boolean;
  adding: boolean;
  onAdd: () => void;
  onClose: () => void;
}
const WordPanel: React.FC<WordPanelProps> = ({
  token,
  isSaved,
  adding,
  onAdd,
  onClose,
}) => {
  const lemma =
    token.lemma ||
    token.dictionaryForm ||
    token.surface;

  const [entries, setEntries] =
    useState<DictionaryEntry[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    let cancelled = false;

    setEntries([]);
    setError(null);
    setLoading(true);

    lookupJapanese(
      lemma,
      controller.signal
    )
      .then((result) => {
        if (!cancelled) {
          setEntries(result);
        }
      })
      .catch((reason: unknown) => {
        if (
          controller.signal.aborted ||
          cancelled
        ) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : 'Dictionary lookup failed.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lemma]);

  const reading =
    token.reading ||
    entries[0]?.reading;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/80 overflow-hidden shadow-2xl shadow-black/20">
      <div className="p-5 border-b border-zinc-800/70">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-4xl text-zinc-50">
              {token.surface}
            </div>

            {reading && (
              <div className="text-sm text-amber-400 mt-1">
                {reading}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X size={15} />
          </button>
        </div>

        {lemma !== token.surface && (
          <div className="text-xs text-zinc-500 mt-3">
            Dictionary form:{' '}
            <strong className="text-zinc-300">
              {lemma}
            </strong>
          </div>
        )}

        {token.partOfSpeech && (
          <div className="text-[10px] text-zinc-600 mt-2">
            {token.partOfSpeech}
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {loading && (
          <div className="text-xs text-zinc-500">
            Looking up {lemma}…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/10 bg-red-400/5 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          entries.length === 0 && (
            <div className="text-xs text-zinc-500">
              No dictionary entry found for{' '}
              <strong>{lemma}</strong>.
            </div>
          )}

        {entries.map((entry, entryIndex) => (
          <div
            key={`${entry.word}-${entryIndex}`}
            className="space-y-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <strong className="text-sm text-zinc-100">
                {entry.word}
              </strong>

              {entry.reading && (
                <span className="text-xs text-amber-400">
                  {entry.reading}
                </span>
              )}
            </div>

            {entry.senses.map(
              (sense, senseIndex) => (
                <div key={senseIndex}>
                  {sense.partsOfSpeech.length >
                    0 && (
                    <div className="text-[10px] text-zinc-600 mb-1">
                      {sense.partsOfSpeech.join(', ')}
                    </div>
                  )}

                  <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
                    {sense.englishDefinitions.map(
                      (
                        definition,
                        definitionIndex
                      ) => (
                        <li
                          key={definitionIndex}
                        >
                          {definition}
                        </li>
                      )
                    )}
                  </ol>
                </div>
              )
            )}
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Badge variant="muted">
            Local token
          </Badge>

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
            onClick={() => {
              if (
                'speechSynthesis' in window
              ) {
                window.speechSynthesis.cancel();

                window.speechSynthesis.speak(
                  new SpeechSynthesisUtterance(
                    token.surface
                  )
                );
              }
            }}
          >
            <Volume2 size={14} />
            Listen
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 text-xs"
            onClick={() => {
              // AI explanation belongs in the backend later.
              // Keep the reader fully local for dictionary lookup now.
            }}
          >
            <Sparkles size={14} />
            Explain
          </button>
        </div>

        {!isSaved ? (
        <Button
          fullWidth
          onClick={onAdd}
          disabled={adding}
        >
          {adding ? (
            <>
              <span className="animate-spin">◌</span>
              Adding…
            </>
          ) : (
            <>
              <Plus size={15} />
              Add to SRS
            </>
          )}
        </Button>
      ) : (
        <Button
          variant="secondary"
          fullWidth
        >
          <BookOpen size={14} />
          View Card
        </Button>
      )}

        <div className="pt-4 border-t border-zinc-800/70 flex items-center justify-between text-[10px] text-zinc-600">
          <span>
            Lemma: {lemma}
          </span>

          <span className="flex items-center gap-1">
            <Headphones size={10} />
            Local reader
          </span>
        </div>
      </div>
    </div>
  );
};