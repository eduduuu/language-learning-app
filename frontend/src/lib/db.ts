import { openDB, type DBSchema } from 'idb';
import type { BookSummary, LocalChapter, LocalBookFile } from '../types/book';

export interface WordLookupRecord {
  word: string;
  language: string;
  lookupCount: number;
  firstLookedUpAt: string;
  lastLookedUpAt: string;
}

export interface CachedDictionaryRecord {
  word: string;
  entries: any[];
  cachedAt: string;
}

interface ContextReaderDB extends DBSchema {
  books: {
    key: string;
    value: BookSummary;
  };

  chapters: {
    key: string;
    value: LocalChapter;
    indexes: {
      bookId: string;
    };
  };

  files: {
    key: string;
    value: LocalBookFile;
  };

  word_lookups: {
    key: string;
    value: WordLookupRecord;
  };

  dictionary_cache: {
    key: string;
    value: CachedDictionaryRecord;
  };

  meta: {
    key: string;
    value: string;
  };
}

const DB_NAME = 'context-reader';
const DB_VERSION = 3;

export const dbPromise = openDB<ContextReaderDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('books')) {
      db.createObjectStore('books');
    }

    if (!db.objectStoreNames.contains('chapters')) {
      const chapters = db.createObjectStore('chapters');
      chapters.createIndex('bookId', 'bookId');
    }

    if (!db.objectStoreNames.contains('files')) {
      db.createObjectStore('files');
    }

    if (!db.objectStoreNames.contains('word_lookups')) {
      db.createObjectStore('word_lookups');
    }

    if (!db.objectStoreNames.contains('dictionary_cache')) {
      db.createObjectStore('dictionary_cache');
    }

    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta');
    }
  },
});

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;

  try {
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 1000)
    );
    return await Promise.race([navigator.storage.persist(), timeoutPromise]);
  } catch {
    return false;
  }
}

export async function isPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
