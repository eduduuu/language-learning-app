import React, {
  useEffect,
  useState,
} from 'react';

import {
  Brain,
  CheckCircle2,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';

import {
  enrichBookSentence,
  generateVocabulary,
  getBooks,
  reviewVocabularyCard,
  type AIVocabResponse,
  type SavedBook,
  type VocabWordDetail,
} from '../lib/api';

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
  Slider,
} from '../components/ui';

import {
  findSentenceInBook,
  listLocalBooks,
} from '../lib/localBookStore';

interface LocalSavedBook {
  id: string;
  title: string;
  language: string;
  fingerprint?: string;
}

interface VocabCard {
  words: string[];
  sentence: string;
  translation: string;
  word_details: VocabWordDetail[];
  source: 'ai' | 'book';
}

type Rating =
  | 'very_hard'
  | 'hard'
  | 'ok'
  | 'good';

const RATINGS: {
  id: Rating;
  label: string;
  ring: string;
  text: string;
}[] = [
  {
    id: 'very_hard',
    label: 'Again',
    ring: 'hover:border-rose-500/60 hover:bg-rose-500/10',
    text: 'text-rose-300',
  },
  {
    id: 'hard',
    label: 'Hard',
    ring: 'hover:border-amber-500/60 hover:bg-amber-500/10',
    text: 'text-amber-300',
  },
  {
    id: 'ok',
    label: 'Good',
    ring: 'hover:border-sky-500/60 hover:bg-sky-500/10',
    text: 'text-sky-300',
  },
  {
    id: 'good',
    label: 'Easy',
    ring: 'hover:border-emerald-500/60 hover:bg-emerald-500/10',
    text: 'text-emerald-300',
  },
];

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}

export const Vocabulary: React.FC = () => {
  const [mode, setMode] =
    useState<'jlpt' | 'books'>(
      'jlpt',
    );

  const [sentenceMode, setSentenceMode] =
    useState<'book' | 'ai'>(
      'book',
    );

  const [language, setLanguage] =
    useState<
      'japanese' | 'english'
    >('japanese');

  const [jlptLevel, setJlptLevel] =
    useState('N5');

  const [selectedBookId, setSelectedBookId] =
    useState('');

  const [selectedLocalBookId, setSelectedLocalBookId] =
    useState('');

  const [startPage, setStartPage] =
    useState(1);

  const [endPage, setEndPage] =
    useState(10);

  const [sentenceMaxWords, setSentenceMaxWords] =
    useState(20);

  const [kanjiDensity, setKanjiDensity] =
    useState(0.5);

  const [targetVocabCount, setTargetVocabCount] =
    useState(3);

  const [books, setBooks] =
    useState<SavedBook[]>([]);

  const [localBooks, setLocalBooks] =
    useState<LocalSavedBook[]>([]);

  const [card, setCard] =
    useState<VocabCard | null>(
      null,
    );

  const [showAnswer, setShowAnswer] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [enriching, setEnriching] =
    useState(false);

  const [reviewing, setReviewing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [reviewSuccess, setReviewSuccess] =
    useState(false);

  /* ==========================================================
     LOAD BOOKS
     ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadBooks() {
      try {
        const [
          remoteResult,
          localResult,
        ] = await Promise.all([
          getBooks(),
          listLocalBooks(),
        ]);

        if (!mounted) {
          return;
        }

        setBooks(remoteResult);
        setLocalBooks(localResult);

        if (remoteResult.length > 0) {
          setSelectedBookId(
            remoteResult[0].id,
          );
        }

        if (localResult.length > 0) {
          setSelectedLocalBookId(
            localResult[0].id,
          );
        }
      } catch (error) {
        console.error(
          'Failed to load books:',
          error,
        );
      }
    }

    loadBooks();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     MATCH REMOTE BOOK TO LOCAL BOOK
     ========================================================== */

  useEffect(() => {
    if (
      !selectedBookId ||
      !books.length ||
      !localBooks.length
    ) {
      return;
    }

    const remote =
      books.find(
        (book) =>
          book.id ===
          selectedBookId,
      );

    if (!remote) {
      return;
    }

    const sameTitle =
      localBooks.find(
        (book) =>
          book.title.trim() ===
          remote.title.trim(),
      );

    if (sameTitle) {
      setSelectedLocalBookId(
        sameTitle.id,
      );
    }
  }, [
    selectedBookId,
    books,
    localBooks,
  ]);

  /* ==========================================================
     ENRICH LOCAL BOOK SENTENCE
     ========================================================== */

  const enrichBookCard = async (
    sentence: string,
    words: string[],
  ) => {
    if (!sentence || !words.length) {
      return;
    }

    setEnriching(true);

    try {
      const enriched =
        await enrichBookSentence({
          sentence,
          words,
        });

      setCard((current) => {
        if (
          !current ||
          current.source !== 'book' ||
          current.sentence !== sentence
        ) {
          return current;
        }

        return {
          ...current,
          translation:
            enriched.translation,
          word_details:
            enriched.word_details,
        };
      });
    } catch (error) {
      console.error(
        'Failed to enrich book sentence:',
        error,
      );
    } finally {
      setEnriching(false);
    }
  };

  /* ==========================================================
     GENERATE CARD
     ========================================================== */

  const handleGenerateCard =
    async () => {
      setLoading(true);
      setError(null);
      setCard(null);
      setShowAnswer(false);
      setReviewSuccess(false);

      try {
        const effectiveTargetCount =
          mode === 'books' &&
          sentenceMode === 'book'
            ? 1
            : targetVocabCount;

        const response =
          await generateVocabulary({
            mode,

            sentence_mode:
              mode === 'books'
                ? sentenceMode
                : 'ai',

            language,

            jlpt_level:
              mode === 'jlpt'
                ? jlptLevel
                : undefined,

            book_id:
              mode === 'books'
                ? selectedBookId
                : undefined,

            start_page:
              mode === 'books'
                ? startPage
                : undefined,

            end_page:
              mode === 'books'
                ? endPage
                : undefined,

            sentence_max_words:
              sentenceMaxWords,

            kanji_density:
              kanjiDensity,

            target_vocab_count:
              effectiveTargetCount,
          });

        /* ======================================================
           BOOK SENTENCE MODE

           The backend gives us the vocabulary word.
           The sentence itself comes from local IndexedDB.

           The card is displayed immediately.
           Enrichment happens asynchronously afterwards.
           ====================================================== */

        if (
          'sentence_mode' in response &&
          response.sentence_mode ===
            'book'
        ) {
          const word =
            response.words[0];

          if (!word) {
            throw new Error(
              'The backend returned no vocabulary word.',
            );
          }

          if (!selectedLocalBookId) {
            throw new Error(
              'The selected book is not available locally.',
            );
          }

          const localSentence =
            await findSentenceInBook(
              selectedLocalBookId,
              word,
            );

          if (!localSentence) {
            setError(
              `Could not find a sentence containing "${word}" in the local book.`,
            );

            return;
          }

          const initialDetails: VocabWordDetail[] =
            [
              {
                base_word:
                  word,

                conjugated_word:
                  localSentence.conjugatedWord ??
                  word,

                reading:
                  localSentence.reading ??
                  '',

                meaning:
                  localSentence.meaning ??
                  '',
              },
            ];

          setCard({
            words:
              response.words,

            sentence:
              localSentence.sentence,

            translation:
              '',

            word_details:
              initialDetails,

            source:
              'book',
          });

          /*
           * The sentence is already visible.
           * Now ask the backend/LLM for translation,
           * reading, meaning and conjugation details.
           */
          void enrichBookCard(
            localSentence.sentence,
            response.words,
          );

          return;
        }

        /* ======================================================
           AI MODE
           ====================================================== */

        const aiResponse =
          response as AIVocabResponse;

        setCard({
          words:
            aiResponse.words,

          sentence:
            aiResponse.sentence,

          translation:
            aiResponse.translation,

          word_details:
            aiResponse.word_details,

          source:
            'ai',
        });
      } catch (err: unknown) {
        const axiosError =
          err as {
            response?: {
              data?: {
                detail?: string;
              };
            };
            message?: string;
          };

        setError(
          axiosError.response?.data
            ?.detail ||
            axiosError.message ||
            'Failed to generate vocabulary sentence.',
        );
      } finally {
        setLoading(false);
      }
    };

  /* ==========================================================
     REVIEW
     ========================================================== */

  const handleReview = async (
    rating: Rating,
  ) => {
    if (
      !card?.words.length
    ) {
      return;
    }

    setReviewing(true);

    try {
      await reviewVocabularyCard(
        card.words[0],
        language,
        rating,
      );

      setReviewSuccess(true);

      window.setTimeout(() => {
        void handleGenerateCard();
      }, 700);
    } catch (error) {
      console.error(
        'Failed to save progress:',
        error,
      );

      window.alert(
        'Failed to save progress.',
      );
    } finally {
      setReviewing(false);
    }
  };

  /* ==========================================================
     HIGHLIGHT TARGET WORDS
     ========================================================== */

  const renderHighlightedSentence =
    (
      sentence: string,
      details: VocabWordDetail[],
    ) => {
      if (!details?.length) {
        return sentence;
      }

      const words = [
        ...new Set(
          details
            .map(
              (detail) =>
                detail.conjugated_word,
            )
            .filter(Boolean),
        ),
      ].sort(
        (a, b) =>
          b.length - a.length,
      );

      if (!words.length) {
        return sentence;
      }

      const pattern =
        new RegExp(
          `(${words
            .map(escapeRegExp)
            .join('|')})`,
          'g',
        );

      const wordSet =
        new Set(words);

      return sentence
        .split(pattern)
        .map(
          (part, index) =>
            wordSet.has(part) ? (
              <span
                key={index}
                className="text-amber-300 font-medium underline decoration-amber-400/40 decoration-2 underline-offset-[6px]"
              >
                {part}
              </span>
            ) : (
              part
            ),
        );
    };

  return (
    <div className="space-y-10 max-w-7xl">
      <PageHeader
        icon={Brain}
        kicker="Study"
        title="Learn in context"
        subtitle="Study vocabulary from your books or generate AI sentences using the same SRS priority."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <Card className="sticky top-6">
            <CardHeader
              icon={Sliders}
              title="Study configuration"
            />

            <div className="p-6 space-y-5">
              <div>
                <Label>
                  Vocabulary source
                </Label>

                <Segmented
                  value={mode}
                  onChange={(value) =>
                    setMode(
                      value as
                        | 'jlpt'
                        | 'books',
                    )
                  }
                  className="w-full"
                  options={[
                    {
                      value: 'jlpt',
                      label:
                        'JLPT Core',
                    },
                    {
                      value: 'books',
                      label:
                        'My books',
                    },
                  ]}
                />
              </div>

              {mode ===
                'books' && (
                <div>
                  <Label>
                    Sentence source
                  </Label>

                  <Segmented
                    value={
                      sentenceMode
                    }
                    onChange={(
                      value,
                    ) =>
                      setSentenceMode(
                        value as
                          | 'book'
                          | 'ai',
                      )
                    }
                    className="w-full"
                    options={[
                      {
                        value:
                          'book',
                        label:
                          'From book',
                      },
                      {
                        value:
                          'ai',
                        label:
                          'AI generated',
                      },
                    ]}
                  />
                </div>
              )}

              {mode ===
              'jlpt' ? (
                <div>
                  <Label>
                    JLPT level
                  </Label>

                  <Segmented
                    value={
                      jlptLevel
                    }
                    onChange={
                      setJlptLevel
                    }
                    className="w-full"
                    options={[
                      'N5',
                      'N4',
                      'N3',
                      'N2',
                      'N1',
                    ].map(
                      (level) => ({
                        value:
                          level,
                        label:
                          level,
                      }),
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>
                      Book
                    </Label>

                    <select
                      value={
                        selectedBookId
                      }
                      onChange={(
                        event,
                      ) =>
                        setSelectedBookId(
                          event
                            .target
                            .value,
                        )
                      }
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/15"
                    >
                      {books.length ===
                      0 ? (
                        <option value="">
                          No books
                          uploaded
                        </option>
                      ) : (
                        books.map(
                          (book) => (
                            <option
                              key={
                                book.id
                              }
                              value={
                                book.id
                              }
                            >
                              {
                                book.title
                              }
                            </option>
                          ),
                        )
                      )}
                    </select>
                  </div>

                  {sentenceMode ===
                    'book' && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-500">
                      The word comes from
                      the backend, while
                      the sentence comes
                      directly from your
                      local EPUB.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>
                        Start
                      </Label>

                      <Input
                        type="number"
                        min={1}
                        value={
                          startPage
                        }
                        onChange={(
                          event,
                        ) =>
                          setStartPage(
                            parseInt(
                              event
                                .target
                                .value,
                            ) || 1,
                          )
                        }
                      />
                    </div>

                    <div>
                      <Label>
                        End
                      </Label>

                      <Input
                        type="number"
                        min={1}
                        value={
                          endPage
                        }
                        onChange={(
                          event,
                        ) =>
                          setEndPage(
                            parseInt(
                              event
                                .target
                                .value,
                            ) || 1,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                <Slider
                  label="Max sentence length"
                  min={5}
                  max={30}
                  value={
                    sentenceMaxWords
                  }
                  onChange={
                    setSentenceMaxWords
                  }
                  display={`${sentenceMaxWords} words`}
                />

                {language ===
                  'japanese' && (
                  <Slider
                    label="Kanji density"
                    min={0}
                    max={1}
                    step={0.1}
                    value={
                      kanjiDensity
                    }
                    onChange={
                      setKanjiDensity
                    }
                    display={`${Math.round(
                      kanjiDensity *
                        100,
                    )}%`}
                  />
                )}

                {!(
                  mode ===
                    'books' &&
                  sentenceMode ===
                    'book'
                ) && (
                  <Slider
                    label="Target words"
                    min={1}
                    max={5}
                    value={
                      targetVocabCount
                    }
                    onChange={
                      setTargetVocabCount
                    }
                    display={`${targetVocabCount}`}
                  />
                )}
              </div>

              <Button
                onClick={
                  handleGenerateCard
                }
                disabled={
                  mode ===
                    'books' &&
                  !selectedBookId
                }
                loading={
                  loading
                }
                fullWidth
                size="lg"
              >
                {!loading && (
                  <Sparkles
                    size={16}
                  />
                )}

                {loading
                  ? 'Generating…'
                  : 'Generate card'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {!card &&
            !loading && (
              <EmptyState
                icon={Brain}
                title="No active card"
                description="Set your study parameters on the left and generate a card to begin."
                className="h-full min-h-[480px]"
              />
            )}

          {loading && (
            <Card className="grid place-items-center min-h-[480px]">
              <LoadingState message="Finding vocabulary and composing your context…" />
            </Card>
          )}

          {card &&
            !loading && (
              <Card className="relative min-h-[480px] flex flex-col overflow-hidden animate-fade-in">
                {reviewSuccess && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-950/90 backdrop-blur-sm animate-fade-in">
                    <div className="flex flex-col items-center gap-2 text-emerald-400">
                      <CheckCircle2
                        size={40}
                        className="animate-pulse"
                      />

                      <span className="text-sm font-medium">
                        Progress saved
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-8 sm:p-10 flex-1 flex flex-col gap-6">
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="muted">
                      {card.source ===
                      'book'
                        ? 'From your book'
                        : 'AI generated'}
                    </Badge>

                    {card.source ===
                      'book' &&
                      enriching && (
                        <span className="text-[10px] text-zinc-500">
                          Enriching…
                        </span>
                      )}
                  </div>

                  <div className="flex-1 grid place-items-center min-h-[140px]">
                    <p className="font-display text-3xl sm:text-[2.5rem] leading-[1.35] text-zinc-50 text-center max-w-2xl tracking-tight">
                      {renderHighlightedSentence(
                        card.sentence,
                        card.word_details,
                      )}
                    </p>
                  </div>

                  {showAnswer ? (
                    <div className="space-y-4 animate-fade-in">
                      {card.translation && (
                        <div className="p-5 rounded-xl bg-amber-400/[0.04] border border-amber-400/20">
                          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-amber-400/90 block mb-2">
                            Translation
                          </span>

                          <p className="text-base text-zinc-100 leading-relaxed">
                            {
                              card.translation
                            }
                          </p>
                        </div>
                      )}

                      <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500 block mb-4">
                          Vocabulary breakdown
                        </span>

                        <div className="space-y-4">
                          {card.word_details.map(
                            (
                              detail,
                              index,
                            ) => (
                              <div
                                key={
                                  index
                                }
                                className="flex flex-col border-l-2 border-amber-400/40 pl-4"
                              >
                                <div className="flex items-baseline gap-3 flex-wrap">
                                  <span className="text-lg font-semibold text-zinc-100">
                                    {
                                      detail.base_word
                                    }
                                  </span>

                                  {detail.conjugated_word &&
                                    detail.conjugated_word !==
                                      detail.base_word && (
                                      <span className="text-xs text-zinc-500">
                                        in sentence:{' '}
                                        {
                                          detail.conjugated_word
                                        }
                                      </span>
                                    )}

                                  <span className="text-xs font-mono text-zinc-500">
                                    {
                                      detail.reading
                                    }
                                  </span>
                                </div>

                                {detail.meaning && (
                                  <span className="text-sm text-zinc-400 mt-1">
                                    {
                                      detail.meaning
                                    }
                                  </span>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setShowAnswer(
                          true,
                        )
                      }
                      className="w-full py-5 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/40 hover:bg-amber-400/[0.03] text-zinc-400 hover:text-amber-300 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Eye
                        size={16}
                      />
                      Reveal translation
                      & notes
                    </button>
                  )}
                </div>

                {showAnswer && (
                  <div className="px-8 sm:px-10 py-6 border-t border-zinc-800/60 bg-zinc-950/40">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500 block text-center mb-3">
                      Rate your recall
                    </span>

                    <div className="grid grid-cols-4 gap-2.5">
                      {RATINGS.map(
                        (rating) => (
                          <button
                            key={
                              rating.id
                            }
                            onClick={() =>
                              void handleReview(
                                rating.id,
                              )
                            }
                            disabled={
                              reviewing
                            }
                            className={`py-3 rounded-lg border border-zinc-800 bg-zinc-900/60 transition-all text-xs font-semibold ${rating.text} ${rating.ring} disabled:opacity-50`}
                          >
                            {
                              rating.label
                            }
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}
        </div>
      </div>
    </div>
  );
};