import type {
  BookSummary,
  LocalBook,
  LocalChapter,
  LocalToken,
} from '../types/book';
import {
  registerLocalEpub,
  type RegisterUnit,
  type RegisterVocabularyItem,
} from './api';
import { dbPromise } from './db';

function tokenIsVocabulary(token: LocalToken): boolean {
  if (token.isWordLike === false) return false;

  const value = (
    token.lemma || token.dictionaryForm || token.surface
  ).trim();

  return value.length > 0;
}

function tokenLemma(token: LocalToken): string {
  return (
    token.lemma?.trim() ||
    token.dictionaryForm?.trim() ||
    token.surface.trim()
  );
}

function buildUnit(
  chapter: LocalChapter,
): RegisterUnit {
  const vocabulary = new Map<
    string,
    RegisterVocabularyItem
  >();

  for (const paragraph of chapter.paragraphs) {
    for (const sentence of paragraph.sentences) {
      for (const token of sentence.tokens) {
        if (!tokenIsVocabulary(token)) continue;

        const lemma = tokenLemma(token);
        if (!lemma) continue;

        const existing = vocabulary.get(lemma);

        if (existing) {
          existing.occurrences += 1;
        } else {
          vocabulary.set(lemma, {
            lemma,
            surface: token.surface,
            occurrences: 1,
          });
        }
      }
    }
  }

  return {
    unit_number: chapter.index + 1,
    vocabulary: Array.from(vocabulary.values()),
  };
}

function buildRegistrationPayload(book: LocalBook) {
  const units = book.chapters.map(buildUnit);

  const uniqueWords = new Set<string>();

  for (const unit of units) {
    for (const item of unit.vocabulary) {
      uniqueWords.add(item.lemma);
    }
  }

  return {
    fingerprint: book.summary.fingerprint,
    title: book.summary.title,
    language: book.summary.language,
    total_unique_words: uniqueWords.size,
    units,
  };
}

export async function syncBookToBackend(
  book: LocalBook,
): Promise<BookSummary> {
  const payload = buildRegistrationPayload(book);

  const response = await registerLocalEpub(payload);

  const updatedSummary: BookSummary = {
    ...book.summary,
    backendId: response.book_id,
    totalWords: response.total_unique_words,
  };

  const db = await dbPromise;

  await db.put(
    'books',
    updatedSummary,
    updatedSummary.id,
  );

  return updatedSummary;
}

export async function syncLocalBookById(
  bookId: string,
): Promise<BookSummary> {
  const db = await dbPromise;
  const summary = await db.get('books', bookId);

  if (!summary) {
    throw new Error(`Local book not found: ${bookId}`);
  }

  const chapters = await db.getAllFromIndex(
    'chapters',
    'bookId',
    bookId,
  );

  chapters.sort((a, b) => a.index - b.index);

  return syncBookToBackend({
    summary,
    chapters,
  });
}


export async function syncPendingLocalBooks(): Promise<void> {
  const db = await dbPromise;
  const books = await db.getAll('books');

  for (const summary of books) {
    if (summary.id.startsWith('demo-')) continue;
    if (summary.backendId) continue;

    try {
      await syncLocalBookById(summary.id);
    } catch (error) {
      // Offline/local-first: one failed book must not prevent other books
      // from being retried on the next application start.
      console.warn(
        `Could not sync local book ${summary.id}.`,
        error,
      );
    }
  }
}
