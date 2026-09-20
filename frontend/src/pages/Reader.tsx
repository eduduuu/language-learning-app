import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import {
  Badge,
  Button,
} from '../components/ui';

import {
  calculateLocalBookMastery,
  getLocalBook,
  recordWordLookup,
  touchLocalBook,
  updateLocalBookPosition,
} from '../lib/localBookStore';

import {
  lookupJapanese,
  type DictionaryEntry,
} from '../lib/dictionary/japanese';

import type {
  LocalBook,
  LocalToken,
} from '../types/book';

import {
  addSRSCard,
  getSRSCards,
  recordWordLookupApi,
  translateSentence,
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

export type FuriganaMode = 'all' | 'unknown_only' | 'none';

function katakanaToHiragana(str?: string): string | undefined {
  if (!str) return undefined;
  return str.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

export const Reader: React.FC<ReaderProps> = ({
  bookId,
  onNavigate,
}) => {
  const [book, setBook] =
    useState<LocalBook | null>(null);

  const [activeChapterIndex, setActiveChapterIndex] =
    useState(0);

  const [selectedWord, setSelectedWord] =
    useState<TokenDetails | null>(null);

  const [savedWords, setSavedWords] =
    useState<Set<string>>(new Set());

  const [srsCardsMap, setSrsCardsMap] =
    useState<Map<string, SRSCard>>(new Map());

  const [furiganaMode, setFuriganaMode] =
    useState<FuriganaMode>('unknown_only');

  const [heatmapEnabled, setHeatmapEnabled] =
    useState<boolean>(true);

  const [settingsOpen, setSettingsOpen] =
    useState<boolean>(false);

  const [addingWord, setAddingWord] =
    useState(false);

  const [mastery, setMastery] =
    useState(0);

  const [knownWords, setKnownWords] =
    useState(0);

  const [totalWords, setTotalWords] =
    useState(0);

  /* ==========================================================
     SENTENCE TRANSLATION
     ========================================================== */

  const [selectedSentenceId, setSelectedSentenceId] =
    useState<string | null>(null);

  const [selectedSentence, setSelectedSentence] =
    useState<string | null>(null);

  const [sentenceTranslation, setSentenceTranslation] =
    useState<string | null>(null);

  const [translatingSentence, setTranslatingSentence] =
    useState(false);

  const [translationError, setTranslationError] =
    useState<string | null>(null);

  const paragraphRefs =
    useRef<Record<string, HTMLDivElement | null>>(
      {},
    );

  const restoredBookmark =
    useRef(false);

  const saveTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const clickTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ==========================================================
     LOAD SRS CARDS
     ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadSRS() {
      try {
        const cards =
          await getSRSCards(
            'japanese',
          );

        if (!mounted) {
          return;
        }

        const map = new Map<string, SRSCard>();
        cards.forEach((card) => map.set(card.word, card));
        setSrsCardsMap(map);

        setSavedWords(
          new Set(
            cards.map(
              (card) =>
                card.word,
            ),
          ),
        );

        const progress =
          await calculateLocalBookMastery(
            bookId,
            cards,
          );

        if (!mounted) {
          return;
        }

        setMastery(
          progress.mastery,
        );

        setKnownWords(
          progress.knownWords,
        );

        setTotalWords(
          progress.totalWords,
        );
      } catch (error) {
        console.error(
          'Failed to load SRS cards:',
          error,
        );
      }
    }

    void loadSRS();

    return () => {
      mounted = false;
    };
  }, [bookId]);

  /* ==========================================================
     LOAD LOCAL BOOK
     ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadBook() {
      const result =
        await getLocalBook(
          bookId,
        );

      if (!mounted || !result) {
        return;
      }

      setBook(result);

      const savedChapterIndex =
        result.chapters.findIndex(
          (chapter) =>
            chapter.id ===
            result.summary
              .currentChapterId,
        );

      setActiveChapterIndex(
        savedChapterIndex >= 0
          ? savedChapterIndex
          : 0,
      );

      await touchLocalBook(
        bookId,
      );
    }

    void loadBook();

    return () => {
      mounted = false;
    };
  }, [bookId]);

  /* ==========================================================
     RESTORE BOOKMARK
     ========================================================== */

  useEffect(() => {
    if (
      !book ||
      restoredBookmark.current
    ) {
      return;
    }

    const sentenceId =
      book.summary
        .currentSentenceId;

    if (!sentenceId) {
      restoredBookmark.current = true;
      return;
    }

    const timeout =
      window.setTimeout(() => {
        const element =
          document.getElementById(
            `sentence-${sentenceId}`,
          );

        if (element) {
          element.scrollIntoView({
            behavior: 'auto',
            block: 'center',
          });
        }

        restoredBookmark.current = true;
      }, 100);

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [
    book,
    activeChapterIndex,
  ]);

  /* ==========================================================
     SAVE READING POSITION
     ========================================================== */

  useEffect(() => {
    if (!book) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visible =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting,
              )
              .sort(
                (a, b) =>
                  a.boundingClientRect
                    .top -
                  b.boundingClientRect
                    .top,
              );

          const first =
            visible[0];

          if (!first) {
            return;
          }

          const sentenceId =
            first.target.getAttribute(
              'data-sentence-id',
            );

          const chapterId =
            first.target.getAttribute(
              'data-chapter-id',
            );

          if (
            !sentenceId ||
            !chapterId
          ) {
            return;
          }

          if (saveTimer.current) {
            clearTimeout(
              saveTimer.current,
            );
          }

          saveTimer.current =
            setTimeout(() => {
              updateLocalBookPosition(
                bookId,
                chapterId,
                sentenceId,
              ).catch((error) => {
                console.error(
                  'Failed to save reading position:',
                  error,
                );
              });
            }, 500);
        },
        {
          root: null,
          threshold: 0.25,
        },
      );

    Object.values(
      paragraphRefs.current,
    ).forEach((element) => {
      if (element) {
        observer.observe(
          element,
        );
      }
    });

    return () => {
      observer.disconnect();

      if (saveTimer.current) {
        clearTimeout(
          saveTimer.current,
        );
      }
    };
  }, [
    book,
    activeChapterIndex,
    bookId,
  ]);

  const activeChapter =
    useMemo(() => {
      if (!book) {
        return null;
      }

      return (
        book.chapters[
          activeChapterIndex
        ] ?? null
      );
    }, [
      book,
      activeChapterIndex,
    ]);

  /* ==========================================================
     SELECT WORD
     ========================================================== */

  const handleSelectToken = (
    token: LocalToken,
  ) => {
    if (token.isWordLike === false) {
      return;
    }

    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
    }

    clickTimer.current = setTimeout(() => {
      setSelectedSentence(null);
      setSentenceTranslation(null);
      setTranslationError(null);

      setSelectedWord(
        token as TokenDetails,
      );
    }, 220);
  };
  const handleDoubleClickSentence = async (
    sentenceId: string,
    sentence: string,
  ) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }

    // Double click = sentence mode.
    // Never show dictionary.
    setSelectedWord(null);

    await handleTranslateSentence(
      sentenceId,
      sentence,
    );
  };

  /* ==========================================================
     TRANSLATE ONLY THE SELECTED SENTENCE
     ========================================================== */

  const handleTranslateSentence = async (
    sentenceId: string,
    sentence: string,
  ) => {
    if (
      !sentence.trim() ||
      translatingSentence
    ) {
      return;
    }

    setSelectedWord(null);

    setSelectedSentenceId(sentenceId);
    setSelectedSentence(sentence);

    setSentenceTranslation(null);
    setTranslationError(null);
    setTranslatingSentence(true);

    try {
      const result =
        await translateSentence({
          sentence,
          language: 'japanese',
        });

      setSentenceTranslation(
        result.translation,
      );
    } catch (error) {
      console.error(
        'Failed to translate sentence:',
        error,
      );

      setTranslationError(
        'Could not translate this sentence.',
      );
    } finally {
      setTranslatingSentence(false);
    }
  };

  /* ==========================================================
     ADD WORD TO SRS
     ========================================================== */

  const handleAddCard = async () => {
    if (
      !selectedWord ||
      addingWord
    ) {
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

      const card =
        await addSRSCard({
          word,
          language:
            'japanese',
        });

      setSavedWords(
        (previous) => {
          const next =
            new Set(previous);

          next.add(card.word);

          return next;
        },
      );

      setSrsCardsMap(
        (previous) => {
          const next =
            new Map(previous);

          next.set(card.word, card);

          return next;
        },
      );

      const cards =
        await getSRSCards(
          'japanese',
        );

      const progress =
        await calculateLocalBookMastery(
          bookId,
          cards,
        );

      setMastery(
        progress.mastery,
      );

      setKnownWords(
        progress.knownWords,
      );

      setTotalWords(
        progress.totalWords,
      );
    } catch (error) {
      console.error(
        'Failed to add word to SRS:',
        error,
      );

      window.alert(
        'Could not add this word to SRS.',
      );
    } finally {
      setAddingWord(false);
    }
  };

  /* ==========================================================
     CHAPTER NAVIGATION
     ========================================================== */

  const goToChapter = async (
    index: number,
  ) => {
    setSelectedWord(null);
    setSelectedSentenceId(null);
    setSelectedSentence(null);
    setSentenceTranslation(null);
    setTranslationError(null);

    const nextChapter =
      book.chapters[index];

    if (!nextChapter) {
      return;
    }

    const firstSentence =
      nextChapter
        .paragraphs[0]
        ?.sentences[0];

    setActiveChapterIndex(
      index,
    );

    if (firstSentence) {
      await updateLocalBookPosition(
        bookId,
        nextChapter.id,
        firstSentence.id,
      );
    }
  };

  if (
    !book ||
    !book.chapters.length
  ) {
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

  return (
    <div className="relative min-h-[calc(100vh-5rem)] animate-slide-up">
      <header className="sticky top-0 z-30 -mx-8 lg:-mx-10 px-8 lg:px-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onNavigate('home')
              }
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

          <div className="hidden sm:flex items-center gap-2 relative">
            <Badge variant="gold">
              {mastery}% mastery
            </Badge>

            <span className="text-[10px] text-zinc-600">
              {knownWords}/
              {totalWords}
            </span>

            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                settingsOpen
                  ? 'bg-zinc-800 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
              title="Reader settings"
            >
              <Settings2 size={16} />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl p-4 shadow-2xl z-50 space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-2">
                    Furigana
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                    {(['all', 'unknown_only', 'none'] as FuriganaMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFuriganaMode(mode)}
                        className={`py-1.5 rounded-md text-[11px] font-medium transition-all ${
                          furiganaMode === mode
                            ? 'bg-amber-400 text-zinc-950 shadow'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {mode === 'all' ? 'All' : mode === 'unknown_only' ? 'Unknown' : 'Off'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">
                        Vocabulary Heatmap
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Color-code words by SRS mastery
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHeatmapEnabled((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        heatmapEnabled ? 'bg-amber-400' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                          heatmapEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,760px)_280px] gap-8 py-8">
        {/* ====================================================
            CHAPTERS
            ==================================================== */}

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-600 px-2 mb-3">
              Chapters
            </div>

            <div className="space-y-1">
              {book.chapters.map(
                (
                  chapter,
                  index,
                ) => (
                  <button
                    key={
                      chapter.id
                    }
                    type="button"
                    onClick={() =>
                      void goToChapter(
                        index,
                      )
                    }
                    className={[
                      'w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all',
                      index ===
                      activeChapterIndex
                        ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
                    ].join(' ')}
                  >
                    <div className="font-medium">
                      {
                        chapter.title
                      }
                    </div>

                    <div className="text-[10px] text-zinc-600 mt-1">
                      {
                        chapter
                          .paragraphs
                          .length
                      }{' '}
                      sections
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>
        </aside>

        {/* ====================================================
            READER
            ==================================================== */}

        <main>
          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold mb-3">
              {activeChapterIndex +
                1}{' '}
              /{' '}
              {
                book.chapters
                  .length
              }
            </div>

            <h1 className="font-display text-4xl sm:text-5xl text-zinc-50">
              {
                activeChapter.title
              }
            </h1>

            <p className="text-xs text-zinc-600 mt-3">
              Click a word for dictionary details.
              Double-click a sentence to translate
              only that sentence.
            </p>
          </div>

          <article className="space-y-7 text-[18px] sm:text-[19px] leading-[2.15] text-zinc-200">
            {activeChapter.paragraphs.map(
              (paragraph) => {
                const firstSentence =
                  paragraph
                    .sentences[0];

                return (
                  <div
                    key={
                      paragraph.id
                    }
                    ref={(element) => {
                      paragraphRefs.current[
                        paragraph.id
                      ] = element;
                    }}
                    data-sentence-id={
                      firstSentence?.id
                    }
                    data-chapter-id={
                      activeChapter.id
                    }
                    className="space-y-3"
                  >
                    {paragraph.sentences.map(
                      (
                        sentence,
                      ) => (
                        <p
                          key={sentence.id}
                          id={`sentence-${sentence.id}`}
                          onDoubleClick={() =>
                            void handleDoubleClickSentence(
                              sentence.id,
                              sentence.tokens
                                .map((token) => token.surface)
                                .join(''),
                            )
                          }
                          className={[
                            'cursor-default select-text rounded-lg px-2 -mx-2 transition-colors',
                            selectedSentenceId === sentence.id
                              ? 'bg-amber-400/10 text-amber-200'
                              : 'hover:bg-zinc-900/60',
                          ].join(' ')}
                          title="Double-click to translate this sentence"
                        >
                          {sentence.tokens.map((token) => {
                            if (token.isWordLike === false) {
                              return (
                                <React.Fragment key={token.id}>
                                  {token.surface}
                                </React.Fragment>
                              );
                            }

                            const lemma =
                              token.lemma?.trim() ||
                              token.dictionaryForm?.trim() ||
                              token.surface.trim();

                            const hasKanji = /[\u4E00-\u9FAF]/.test(token.surface);
                            const card = srsCardsMap.get(lemma);
                            const isSaved = savedWords.has(lemma);
                            const isDue = card
                              ? new Date(card.next_review_date) <= new Date()
                              : false;
                            const isMastered = card
                              ? card.reps >= 3 || card.state === 2
                              : false;
                            const isLearning = isSaved && !isMastered;

                            // Furigana logic
                            const hiragana = katakanaToHiragana(token.reading);
                            const showFurigana =
                              hasKanji &&
                              Boolean(hiragana) &&
                              hiragana !== token.surface &&
                              (furiganaMode === 'all' ||
                                (furiganaMode === 'unknown_only' && !isSaved));

                            // Heatmap styling
                            let heatmapClass =
                              'hover:bg-amber-400/10 hover:text-amber-300';
                            if (heatmapEnabled) {
                              if (isDue) {
                                heatmapClass =
                                  'bg-amber-400/15 text-amber-200 border-b-2 border-amber-400 font-medium hover:bg-amber-400/25';
                              } else if (isLearning) {
                                heatmapClass =
                                  'border-b border-amber-400/50 text-amber-100 bg-amber-400/5 hover:bg-amber-400/15';
                              } else if (isMastered) {
                                heatmapClass =
                                  'text-zinc-100 hover:bg-emerald-400/10 hover:text-emerald-300';
                              } else if (hasKanji) {
                                heatmapClass =
                                  'border-b border-dashed border-zinc-700/80 text-zinc-300 hover:border-amber-400/50 hover:bg-amber-400/10';
                              }
                            }

                            return (
                              <button
                                key={token.id}
                                type="button"
                                onClick={() => handleSelectToken(token)}
                                className={`inline-block mx-[1px] px-0.5 rounded transition-all duration-100 ${heatmapClass}`}
                                title={
                                  token.lemma && token.lemma !== token.surface
                                    ? `Dictionary form: ${token.lemma}${
                                        isDue
                                          ? ' • Due for review'
                                          : isMastered
                                          ? ' • Mastered'
                                          : isLearning
                                          ? ' • Learning'
                                          : ''
                                      }`
                                    : isDue
                                    ? 'Due for review'
                                    : undefined
                                }
                              >
                                {showFurigana ? (
                                  <ruby className="[ruby-align:center]">
                                    {token.surface}
                                    <rt className="text-[10px] text-amber-400/90 font-normal select-none pointer-events-none text-center leading-none">
                                      {hiragana}
                                    </rt>
                                  </ruby>
                                ) : (
                                  token.surface
                                )}
                              </button>
                            );
                          })}
                        </p>
                      ),
                    )}
                  </div>
                );
              },
            )}
          </article>

          <div className="mt-14 pt-6 border-t border-zinc-800/70 flex justify-between gap-4">
            <Button
              variant="secondary"
              disabled={
                activeChapterIndex ===
                0
              }
              onClick={() =>
                void goToChapter(
                  activeChapterIndex -
                    1,
                )
              }
            >
              <ChevronLeft size={15} />
              Previous
            </Button>

            <Button
              disabled={
                activeChapterIndex ===
                book.chapters.length -
                  1
              }
              onClick={() =>
                void goToChapter(
                  activeChapterIndex +
                    1,
                )
              }
            >
              Next Chapter
              <ChevronRight size={15} />
            </Button>
          </div>
        </main>

        {/* ====================================================
            RIGHT PANEL
            ==================================================== */}

        <aside className="lg:block">
          <div className="lg:sticky lg:top-24 space-y-4">
            {selectedSentence && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] overflow-hidden">
                <div className="p-4 border-b border-amber-400/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      size={14}
                      className="text-amber-400"
                    />

                    <span className="text-xs font-semibold text-amber-300">
                      Sentence translation
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSentenceId(null);
                      setSelectedSentence(null);
                      setSentenceTranslation(null);
                      setTranslationError(null);
                    }}
                    className="p-1 rounded text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {
                      selectedSentence
                    }
                  </p>

                  {translatingSentence && (
                    <div className="text-xs text-zinc-500">
                      Translating…
                    </div>
                  )}

                  {translationError && (
                    <div className="text-xs text-red-300">
                      {
                        translationError
                      }
                    </div>
                  )}

                  {sentenceTranslation && (
                    <div className="pt-3 border-t border-amber-400/10">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/80 mb-2">
                        Translation
                      </div>

                      <p className="text-sm text-zinc-100 leading-relaxed">
                        {
                          sentenceTranslation
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selectedWord ? (
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center mb-4">
                  <Languages size={18} />
                </div>

                <h3 className="text-sm font-semibold text-zinc-100">
                  Explore the text
                </h3>

                <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                  Click a Japanese word to see its
                  dictionary form, reading, meaning,
                  and learning status.
                </p>

                <p className="text-xs text-zinc-600 leading-relaxed mt-3">
                  Double-click a sentence to send only
                  that sentence for translation.
                </p>
              </div>
            ) : (
              <WordPanel
                token={selectedWord}
                isSaved={savedWords.has(
                  selectedWord.lemma ||
                    selectedWord.dictionaryForm ||
                    selectedWord.surface,
                )}
                adding={addingWord}
                onAdd={
                  handleAddCard
                }
                onClose={() =>
                  setSelectedWord(
                    null,
                  )
                }
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ==============================================================
   WORD PANEL
   ============================================================== */

interface WordPanelProps {
  token: TokenDetails;
  isSaved: boolean;
  adding: boolean;
  onAdd: () => void;
  onClose: () => void;
}

const WordPanel: React.FC<
  WordPanelProps
> = ({
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
    useState<DictionaryEntry[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [lookupCount, setLookupCount] =
    useState<number>(1);

  useEffect(() => {
    const controller =
      new AbortController();

    let cancelled = false;

    setEntries([]);
    setError(null);
    setLoading(true);

    // Record word lookup locally in IndexedDB and sync to cloud
    recordWordLookup(lemma, 'japanese')
      .then((count) => {
        if (!cancelled) {
          setLookupCount(count);
        }
      })
      .catch((err) => {
        console.error('Failed to record local word lookup:', err);
      });

    recordWordLookupApi(lemma, 'japanese').catch((err) => {
      console.error('Failed to record backend word lookup:', err);
    });

    lookupJapanese(
      lemma,
      controller.signal,
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
            : 'Dictionary lookup failed.',
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

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {reading && (
                <div className="text-sm text-amber-400">
                  {reading}
                </div>
              )}
              {lookupCount > 1 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Looked up {lookupCount}×
                </span>
              )}
            </div>
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
              <strong>
                {lemma}
              </strong>
              .
            </div>
          )}

        {entries.map(
          (
            entry,
            entryIndex,
          ) => (
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
                    {
                      entry.reading
                    }
                  </span>
                )}
              </div>

              {entry.senses.map(
                (
                  sense,
                  senseIndex,
                ) => (
                  <div
                    key={
                      senseIndex
                    }
                  >
                    {sense.partsOfSpeech
                      .length >
                      0 && (
                      <div className="text-[10px] text-zinc-600 mb-1">
                        {sense.partsOfSpeech.join(
                          ', ',
                        )}
                      </div>
                    )}

                    <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
                      {sense.englishDefinitions.map(
                        (
                          definition,
                          definitionIndex,
                        ) => (
                          <li
                            key={
                              definitionIndex
                            }
                          >
                            {
                              definition
                            }
                          </li>
                        ),
                      )}
                    </ol>
                  </div>
                ),
              )}
            </div>
          ),
        )}

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
                'speechSynthesis' in
                window
              ) {
                window.speechSynthesis.cancel();

                window.speechSynthesis.speak(
                  new SpeechSynthesisUtterance(
                    token.surface,
                  ),
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
            title="Double-click a sentence to translate it"
          >
            <Sparkles size={14} />
            Explain
          </button>
        </div>

        {!isSaved && lookupCount >= 3 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-amber-300">
                Frequent Lookup ({lookupCount}×)
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                You've looked this up {lookupCount} times. Add to SRS to commit to memory?
              </div>
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={adding}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-xs whitespace-nowrap transition-colors flex items-center gap-1 shrink-0"
            >
              <Plus size={13} />
              Add Now
            </button>
          </div>
        )}

        {!isSaved ? (
          <Button
            fullWidth
            onClick={onAdd}
            disabled={adding}
          >
            {adding ? (
              <>
                <span className="animate-spin">
                  ◌
                </span>
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