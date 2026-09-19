import { openDB, type DBSchema } from 'idb';
import type { BookSummary, LocalChapter, LocalBookFile } from '../types/book';

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

  meta: {
    key: string;
    value: string;
  };
}

const DB_NAME = 'context-reader';
const DB_VERSION = 1;

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

    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta');
    }
  },
});

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;

  try {
    return await navigator.storage.persist();
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
