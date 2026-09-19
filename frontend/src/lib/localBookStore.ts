import { parseEpubFile } from './japanese/epub/parser';

import type {
  BookLanguage,
  BookStatus,
  BookSummary,
  LocalBook,
  LocalBookFile,
  LocalChapter,
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
  const chapters = await db.getAllFromIndex('chapters', 'bookId', bookId);

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

  transaction.objectStore('books').put(summary, summary.id);
  transaction.objectStore('files').put(file, file.bookId);

  for (const chapter of chapters) {
    transaction.objectStore('chapters').put(chapter, chapter.id);
  }

  await transaction.done;
}

async function deleteBookData(bookId: string): Promise<void> {
  const db = await dbPromise;
  const chapters = await loadChapters(bookId);

  const transaction = db.transaction(
    ['books', 'chapters', 'files'],
    'readwrite'
  );

  transaction.objectStore('books').delete(bookId);
  transaction.objectStore('files').delete(bookId);

  for (const chapter of chapters) {
    transaction.objectStore('chapters').delete(chapter.id);
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

  const summary = await db.get('books', bookId);
  if (!summary) return null;

  const chapters = await loadChapters(bookId);
  const file = await db.get('files', bookId);

  return {
    summary,
    chapters,
    file: file ?? undefined,
  };
}

export async function touchLocalBook(bookId: string): Promise<void> {
  const db = await dbPromise;
  const summary = await db.get('books', bookId);

  if (!summary) return;

  await db.put(
    'books',
    {
      ...summary,
      lastOpenedAt: new Date().toISOString(),
    },
    bookId
  );
}

export async function deleteLocalBook(bookId: string): Promise<void> {
  await deleteBookData(bookId);
}

export async function updateLocalBookStatus(
  bookId: string,
  status: BookStatus
): Promise<void> {
  const db = await dbPromise;
  const summary = await db.get('books', bookId);

  if (!summary) return;

  await db.put(
    'books',
    {
      ...summary,
      status,
    },
    bookId
  );
}

export async function createLocalBookFromEpub(
  title: string,
  language: BookLanguage,
  sourceFile: File,
  onProgress?: (message: string) => void
): Promise<BookSummary> {
  await requestPersistentStorage();

  const reportProgress =
    typeof onProgress === 'function' ? onProgress : () => {};

  reportProgress('Checking EPUB…');

  const fingerprint = await sha256(sourceFile);
  const bookId = `local-${fingerprint.slice(0, 24)}`;
  const createdAt = new Date().toISOString();

  const existing = await getLocalBook(bookId);

  if (existing) {
    reportProgress('This EPUB is already in your local library.');
    return existing.summary;
  }

  reportProgress('Parsing EPUB locally…');

  const chapters = await parseEpubFile(
    bookId,
    sourceFile,
    language,
    reportProgress
  );

  if (chapters.length === 0) {
    throw new Error('No readable chapters were found in this EPUB.');
  }

  const uniqueLemmas = new Set<string>();

  for (const chapter of chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph.sentences) {
        for (const token of sentence.tokens) {
          if (token.isWordLike !== false) {
            const lemma = token.lemma?.trim() || token.surface.trim();
            if (lemma) uniqueLemmas.add(lemma);
          }
        }
      }
    }
  }

  const firstChapter = chapters[0];
  const firstSentence =
    firstChapter?.paragraphs[0]?.sentences[0];

  const summary: BookSummary = {
    id: bookId,
    title:
      title.trim() ||
      sourceFile.name.replace(/\.epub$/i, ''),
    language,
    status: 'learning',
    fingerprint,
    mastery: 0,
    knownWords: 0,
    totalWords: uniqueLemmas.size,
    createdAt,
    lastOpenedAt: createdAt,
    currentChapterId: firstChapter?.id,
    currentSentenceId: firstSentence?.id,
  };

  reportProgress('Saving book locally…');

  await saveImportedBook(
    summary,
    chapters,
    {
      bookId,
      blob: sourceFile,
      fileName: sourceFile.name,
      mimeType: sourceFile.type || 'application/epub+zip',
    }
  );

  reportProgress('Book ready.');
  return summary;
}

/**
 * Development-only helper. Remove before production.
 */
export async function seedMockBooks(): Promise<void> {
  const db = await dbPromise;
  const seeded = await db.get('meta', 'mock-books-seeded');

  if (seeded === 'true') return;

  const existingBooks = await db.getAll('books');

  if (existingBooks.length > 0) {
    await db.put('meta', 'true', 'mock-books-seeded');
    return;
  }

  const demoBooks = [
    {
      id: 'demo-sukamoka',
      title: 'Sukamoka',
      status: 'learning' as BookStatus,
      mastery: 73,
      knownWords: 1420,
      totalWords: 2180,
    },
    {
      id: 'demo-kokoro',
      title: 'Kokoro',
      status: 'on_hold' as BookStatus,
      mastery: 48,
      knownWords: 820,
      totalWords: 2010,
    },
    {
      id: 'demo-reader',
      title: 'Another Japanese Reader',
      status: 'completed' as BookStatus,
      mastery: 96,
      knownWords: 1940,
      totalWords: 2020,
    },
  ];

  for (const demo of demoBooks) {
    const createdAt = new Date().toISOString();

    await db.put(
      'books',
      {
        id: demo.id,
        title: demo.title,
        language: 'japanese',
        status: demo.status,
        fingerprint: `demo-${demo.id}`,
        mastery: demo.mastery,
        knownWords: demo.knownWords,
        totalWords: demo.totalWords,
        createdAt,
        lastOpenedAt: createdAt,
        currentChapterId: `${demo.id}-ch-1`,
        currentSentenceId: `${demo.id}-s-2`,
      },
      demo.id
    );
  }

  await db.put('meta', 'true', 'mock-books-seeded');
}
