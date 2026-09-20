import { parseEpubFile } from './japanese/epub/parser';

import type {
  BookLanguage,
  BookStatus,
  BookSummary,
  LocalBook,
  LocalBookFile,
  LocalChapter,
  LocalToken,
} from '../types/book';

import {
  dbPromise,
  requestPersistentStorage,
} from './db';

async function sha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function loadChapters(bookId: string): Promise<LocalChapter[]> {
  const db = await dbPromise;
  const chapters = await db.getAllFromIndex(
    'chapters',
    'bookId',
    bookId
  );

  return chapters.sort((a, b) => a.index - b.index);
}

async function saveImportedBook(
  summary: BookSummary,
  chapters: LocalChapter[],
  file: LocalBookFile
): Promise<void> {
  const db = await dbPromise;

  const transaction = db.transaction(
    ['books', 'chapters', 'files'],
    'readwrite'
  );

  transaction.objectStore('books').put(
    summary,
    summary.id
  );

  transaction.objectStore('files').put(
    file,
    file.bookId
  );

  for (const chapter of chapters) {
    transaction.objectStore('chapters').put(
      chapter,
      chapter.id
    );
  }

  await transaction.done;
}

async function deleteBookData(
  bookId: string
): Promise<void> {
  const db = await dbPromise;
  const chapters = await loadChapters(bookId);

  const transaction = db.transaction(
    ['books', 'chapters', 'files'],
    'readwrite'
  );

  transaction.objectStore('books').delete(bookId);
  transaction.objectStore('files').delete(bookId);

  for (const chapter of chapters) {
    transaction.objectStore('chapters').delete(
      chapter.id
    );
  }

  await transaction.done;
}

export async function listLocalBooks(): Promise<BookSummary[]> {
  const db = await dbPromise;
  const books = await db.getAll('books');

  return books.sort(
    (a, b) =>
      new Date(b.lastOpenedAt).getTime() -
      new Date(a.lastOpenedAt).getTime()
  );
}

export async function getLocalBook(
  bookId: string
): Promise<LocalBook | null> {
  const db = await dbPromise;

  const summary = await db.get(
    'books',
    bookId
  );

  if (!summary) {
    return null;
  }

  const chapters = await loadChapters(bookId);
  const file = await db.get('files', bookId);

  return {
    summary,
    chapters,
    file: file ?? undefined,
  };
}

export async function touchLocalBook(
  bookId: string
): Promise<void> {
  const db = await dbPromise;

  const summary = await db.get(
    'books',
    bookId
  );

  if (!summary) {
    return;
  }

  await db.put(
    'books',
    {
      ...summary,
      lastOpenedAt: new Date().toISOString(),
    },
    bookId
  );
}

/**
 * Persist the reader bookmark.
 *
 * We only need chapterId + sentenceId.
 * The paragraph can be reconstructed from the sentence
 * when the book is opened again.
 */
export async function updateLocalBookPosition(
  bookId: string,
  chapterId: string,
  sentenceId: string
): Promise<void> {
  const db = await dbPromise;

  const summary = await db.get(
    'books',
    bookId
  );

  if (!summary) {
    return;
  }

  await db.put(
    'books',
    {
      ...summary,
      currentChapterId: chapterId,
      currentSentenceId: sentenceId,
      lastOpenedAt: new Date().toISOString(),
    },
    bookId
  );
}

export async function deleteLocalBook(
  bookId: string
): Promise<void> {
  await deleteBookData(bookId);
}

export async function updateLocalBookStatus(
  bookId: string,
  status: BookStatus
): Promise<void> {
  const db = await dbPromise;

  const summary = await db.get(
    'books',
    bookId
  );

  if (!summary) {
    return;
  }

  await db.put(
    'books',
    {
      ...summary,
      status,
    },
    bookId
  );
}

/**
 * Find a sentence containing a target lemma in the
 * locally stored EPUB.
 *
 * IMPORTANT:
 * We search the local IndexedDB copy.
 * We do NOT need the EPUB or sentences in Supabase.
 */
export interface LocalSentence {
  sentence: string;
  conjugatedWord?: string;
  reading?: string;
  meaning?: string;
}

export async function findSentenceInBook(
  bookId: string,
  targetWord: string
): Promise<LocalSentence | null> {
  const book = await getLocalBook(bookId);

  if (!book) {
    return null;
  }

  const normalizedTarget = targetWord
    .trim()
    .toLocaleLowerCase();

  if (!normalizedTarget) {
    return null;
  }

  for (const chapter of book.chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph.sentences) {
        const matchingToken = sentence.tokens.find(
          (token: LocalToken) => {
            if (token.isWordLike === false) {
              return false;
            }

            const lemma =
              token.lemma?.trim() ||
              token.dictionaryForm?.trim() ||
              token.surface?.trim();

            return (
              lemma?.toLocaleLowerCase() ===
              normalizedTarget
            );
          }
        );

        if (!matchingToken) {
          continue;
        }

        return {
          sentence: sentence.text,
          conjugatedWord:
            matchingToken.surface ||
            matchingToken.lemma ||
            normalizedTarget,
          reading: matchingToken.reading,
        };
      }
    }
  }

  return null;
}

/**
 * Find a sentence containing a target word across any local book in IndexedDB.
 */
export async function findSentenceAcrossAllBooks(
  targetWord: string
): Promise<{ sentence: LocalSentence; bookId: string; bookTitle: string } | null> {
  const books = await listLocalBooks();
  for (const b of books) {
    const found = await findSentenceInBook(b.id, targetWord);
    if (found) {
      return { sentence: found, bookId: b.id, bookTitle: b.title };
    }
  }
  return null;
}

/**
 * Return all unique lemmas in a locally stored book.
 *
 * Used for book mastery.
 */
export async function getBookLemmas(
  bookId: string
): Promise<Set<string>> {
  const book = await getLocalBook(bookId);

  const result = new Set<string>();

  if (!book) {
    return result;
  }

  for (const chapter of book.chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph.sentences) {
        for (const token of sentence.tokens) {
          if (token.isWordLike === false) {
            continue;
          }

          const lemma =
            token.lemma?.trim() ||
            token.dictionaryForm?.trim() ||
            token.surface?.trim();

          if (lemma) {
            result.add(lemma);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Calculate book mastery from the global SRS cards.
 *
 * A word counts as learned when its SRS state is
 * a learning/review state rather than New.
 *
 * FSRS state:
 * 0 = New
 * 1 = Learning
 * 2 = Review
 * 3 = Relearning
 *
 * We treat Review (2) as learned for book mastery.
 */
export async function calculateLocalBookMastery(
  bookId: string,
  srsCards: Array<{
    word: string;
    state: number;
  }>
): Promise<{
  mastery: number;
  knownWords: number;
  totalWords: number;
}> {
  const bookWords = await getBookLemmas(bookId);

  const learnedWords = new Set(
    srsCards
      .filter((card) => card.state === 2)
      .map((card) =>
        card.word.trim().toLocaleLowerCase()
      )
  );

  let knownWords = 0;

  for (const word of bookWords) {
    if (
      learnedWords.has(
        word.trim().toLocaleLowerCase()
      )
    ) {
      knownWords += 1;
    }
  }

  const totalWords = bookWords.size;

  const mastery =
    totalWords === 0
      ? 0
      : Math.round(
          (knownWords / totalWords) * 100
        );

  return {
    mastery,
    knownWords,
    totalWords,
  };
}

export async function createLocalBookFromEpub(
  title: string,
  language: BookLanguage,
  sourceFile: File,
  onProgress?: (message: string) => void
): Promise<BookSummary> {
  await requestPersistentStorage();

  const reportProgress =
    typeof onProgress === 'function'
      ? onProgress
      : () => {};

  reportProgress('Checking EPUB…');

  const fingerprint =
    await sha256(sourceFile);

  const bookId =
    `local-${fingerprint.slice(0, 24)}`;

  const createdAt =
    new Date().toISOString();

  const existing =
    await getLocalBook(bookId);

  if (existing) {
    reportProgress(
      'This EPUB is already in your local library.'
    );

    return existing.summary;
  }

  reportProgress(
    'Parsing EPUB locally…'
  );

  const { chapters, coverUrl } =
    await parseEpubFile(
      bookId,
      sourceFile,
      language,
      reportProgress
    );

  if (chapters.length === 0) {
    throw new Error(
      'No readable chapters were found in this EPUB.'
    );
  }

  const uniqueLemmas =
    new Set<string>();

  for (const chapter of chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph.sentences) {
        for (const token of sentence.tokens) {
          if (token.isWordLike === false) {
            continue;
          }

          const lemma =
            token.lemma?.trim() ||
            token.surface.trim();

          if (lemma) {
            uniqueLemmas.add(lemma);
          }
        }
      }
    }
  }

  const firstChapter =
    chapters[0];

  const firstSentence =
    firstChapter
      ?.paragraphs[0]
      ?.sentences[0];

  const summary: BookSummary = {
    id: bookId,

    title:
      title.trim() ||
      sourceFile.name.replace(
        /\.epub$/i,
        ''
      ),

    language,

    status: 'learning',

    coverUrl,

    fingerprint,

    mastery: 0,

    knownWords: 0,

    totalWords:
      uniqueLemmas.size,

    createdAt,

    lastOpenedAt:
      createdAt,

    currentChapterId:
      firstChapter?.id,

    currentSentenceId:
      firstSentence?.id,
  };

  reportProgress(
    'Saving book locally…'
  );

  await saveImportedBook(
    summary,
    chapters,
    {
      bookId,
      blob: sourceFile,
      fileName: sourceFile.name,
      mimeType:
        sourceFile.type ||
        'application/epub+zip',
    }
  );

  reportProgress(
    'Book ready.'
  );

  return summary;
}

/**
 * Development-only helper.
 * Remove before production.
 */
export async function seedMockBooks(): Promise<void> {
  const db = await dbPromise;

  const seeded =
    await db.get(
      'meta',
      'mock-books-seeded'
    );

  if (seeded === 'true') {
    return;
  }

  const existingBooks =
    await db.getAll('books');

  if (existingBooks.length > 0) {
    await db.put(
      'meta',
      'true',
      'mock-books-seeded'
    );

    return;
  }

  const demoBooks = [
    {
      id: 'demo-sukamoka',
      title: 'Sukamoka',
      status:
        'learning' as BookStatus,
      mastery: 73,
      knownWords: 1420,
      totalWords: 2180,
    },
    {
      id: 'demo-kokoro',
      title: 'Kokoro',
      status:
        'on_hold' as BookStatus,
      mastery: 48,
      knownWords: 820,
      totalWords: 2010,
    },
    {
      id: 'demo-reader',
      title:
        'Another Japanese Reader',
      status:
        'completed' as BookStatus,
      mastery: 96,
      knownWords: 1940,
      totalWords: 2020,
    },
  ];

  for (const demo of demoBooks) {
    const createdAt =
      new Date().toISOString();

    await db.put(
      'books',
      {
        id: demo.id,
        title: demo.title,
        language: 'japanese',
        status: demo.status,
        fingerprint:
          `demo-${demo.id}`,
        mastery: demo.mastery,
        knownWords:
          demo.knownWords,
        totalWords:
          demo.totalWords,
        createdAt,
        lastOpenedAt:
          createdAt,
        currentChapterId:
          `${demo.id}-ch-1`,
        currentSentenceId:
          `${demo.id}-s-2`,
      },
      demo.id
    );
  }

  await db.put(
    'meta',
    'true',
    'mock-books-seeded'
  );
}

/* ============================================================
   WORD LOOKUP FREQUENCY & TRACKING
   ============================================================ */

export async function recordWordLookup(
  word: string,
  language: string = 'japanese'
): Promise<number> {
  const normalized = word.trim();
  if (!normalized) return 0;

  const db = await dbPromise;
  const key = `${language}:${normalized}`;
  const existing = await db.get('word_lookups', key);
  const now = new Date().toISOString();

  if (existing) {
    const updated = {
      ...existing,
      lookupCount: existing.lookupCount + 1,
      lastLookedUpAt: now,
    };
    await db.put('word_lookups', updated, key);
    return updated.lookupCount;
  }

  const initial = {
    word: normalized,
    language,
    lookupCount: 1,
    firstLookedUpAt: now,
    lastLookedUpAt: now,
  };
  await db.put('word_lookups', initial, key);
  return 1;
}

export async function getWordLookupCount(
  word: string,
  language: string = 'japanese'
): Promise<number> {
  const normalized = word.trim();
  if (!normalized) return 0;

  const db = await dbPromise;
  const key = `${language}:${normalized}`;
  const record = await db.get('word_lookups', key);
  return record ? record.lookupCount : 0;
}