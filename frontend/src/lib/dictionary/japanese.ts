import { api } from '../api';
import { dbPromise } from '../db';

export interface DictionarySense {
  englishDefinitions: string[];
  partsOfSpeech: string[];
}

export interface DictionaryEntry {
  word: string;
  reading?: string;
  senses: DictionarySense[];
}

interface JishoResponse {
  data?: Array<{
    japanese?: Array<{
      word?: string;
      reading?: string;
    }>;
    senses?: Array<{
      english_definitions?: string[];
      parts_of_speech?: string[];
    }>;
  }>;
}

// Built-in 0ms definitions for high-frequency grammatical particles & markers
const GRAMMAR_PARTICLES: Record<string, DictionaryEntry> = {
  'は': {
    word: 'は',
    reading: 'wa',
    senses: [{ englishDefinitions: ['topic marker particle ("as for...")'], partsOfSpeech: ['Particle'] }],
  },
  'が': {
    word: 'が',
    reading: 'ga',
    senses: [{ englishDefinitions: ['subject marker particle; but / however'], partsOfSpeech: ['Particle', 'Conjunction'] }],
  },
  'を': {
    word: 'を',
    reading: 'o / wo',
    senses: [{ englishDefinitions: ['direct object marker particle'], partsOfSpeech: ['Particle'] }],
  },
  'に': {
    word: 'に',
    reading: 'ni',
    senses: [{ englishDefinitions: ['target, location, time, or indirect object marker particle ("at", "in", "to", "for")'], partsOfSpeech: ['Particle'] }],
  },
  'で': {
    word: 'で',
    reading: 'de',
    senses: [{ englishDefinitions: ['location of action, means, method, or material particle ("at", "in", "by", "with")'], partsOfSpeech: ['Particle'] }],
  },
  'と': {
    word: 'と',
    reading: 'to',
    senses: [{ englishDefinitions: ['and, with (exhaustive listing); quotation marker ("that")'], partsOfSpeech: ['Particle'] }],
  },
  'も': {
    word: 'も',
    reading: 'mo',
    senses: [{ englishDefinitions: ['also, too, as well'], partsOfSpeech: ['Particle'] }],
  },
  'へ': {
    word: 'へ',
    reading: 'e',
    senses: [{ englishDefinitions: ['direction marker particle ("towards", "to")'], partsOfSpeech: ['Particle'] }],
  },
  'から': {
    word: 'から',
    reading: 'kara',
    senses: [{ englishDefinitions: ['from, since, because, after'], partsOfSpeech: ['Particle'] }],
  },
  'まで': {
    word: 'まで',
    reading: 'made',
    senses: [{ englishDefinitions: ['until, up to, as far as'], partsOfSpeech: ['Particle'] }],
  },
  'より': {
    word: 'より',
    reading: 'yori',
    senses: [{ englishDefinitions: ['more than (comparison); from'], partsOfSpeech: ['Particle'] }],
  },
  'の': {
    word: 'の',
    reading: 'no',
    senses: [{ englishDefinitions: ['possessive particle ("\'s", "of"); nominalizer'], partsOfSpeech: ['Particle'] }],
  },
  'か': {
    word: 'か',
    reading: 'ka',
    senses: [{ englishDefinitions: ['question marker particle; or'], partsOfSpeech: ['Particle'] }],
  },
  'ね': {
    word: 'ね',
    reading: 'ne',
    senses: [{ englishDefinitions: ['sentence-ending particle (agreement seeker: "isn\'t it?", "right?")'], partsOfSpeech: ['Particle'] }],
  },
  'よ': {
    word: 'よ',
    reading: 'yo',
    senses: [{ englishDefinitions: ['sentence-ending particle (assertion / new info: "you know", "I tell you")'], partsOfSpeech: ['Particle'] }],
  },
};

// In-memory hot cache for synchronous 0ms lookups
const dictionaryCache = new Map<string, DictionaryEntry[]>();

export async function lookupJapanese(
  word: string,
  signal?: AbortSignal,
): Promise<DictionaryEntry[]> {
  const normalized = word.trim();

  if (!normalized) {
    return [];
  }

  // 1. Check in-memory hot cache (0ms)
  const cachedMem = dictionaryCache.get(normalized);
  if (cachedMem) {
    return cachedMem;
  }

  // 2. Check built-in grammar particles (0ms)
  if (GRAMMAR_PARTICLES[normalized]) {
    const entries = [GRAMMAR_PARTICLES[normalized]];
    dictionaryCache.set(normalized, entries);
    return entries;
  }

  // 3. Check persistent IndexedDB cache (~1ms, offline)
  try {
    const db = await dbPromise;
    const record = await db.get('dictionary_cache', normalized);
    if (record && record.entries && record.entries.length > 0) {
      dictionaryCache.set(normalized, record.entries);
      return record.entries;
    }
  } catch (err) {
    // Non-blocking fallback to network
  }

  // 4. Fallback to backend API
  const { data } = await api.get<JishoResponse>(
    '/dictionary/japanese',
    {
      params: {
        word: normalized,
      },
      signal,
    },
  );

  const entries: DictionaryEntry[] =
    (data.data ?? []).map((entry) => ({
      word:
        entry.japanese?.[0]?.word ??
        normalized,

      reading:
        entry.japanese?.[0]?.reading,

      senses:
        (entry.senses ?? [])
          .slice(0, 5)
          .map((sense) => ({
            englishDefinitions:
              sense.english_definitions ?? [],

            partsOfSpeech:
              sense.parts_of_speech ?? [],
          })),
    }));

  // Store in hot memory cache
  dictionaryCache.set(normalized, entries);

  // Persist into IndexedDB
  try {
    const db = await dbPromise;
    await db.put(
      'dictionary_cache',
      {
        word: normalized,
        entries,
        cachedAt: new Date().toISOString(),
      },
      normalized,
    );
  } catch (err) {
    // Non-blocking
  }

  return entries;
}

interface BatchLookupResponse {
  results: Record<string, DictionaryEntry[]>;
}

/**
 * Batch lookup multiple Japanese words in parallel via IndexedDB and backend batch endpoint.
 * Results are stored in both the memory cache and IndexedDB for permanent instant access.
 */
export async function batchLookupJapanese(
  words: string[],
  signal?: AbortSignal,
): Promise<Map<string, DictionaryEntry[]>> {
  const result = new Map<string, DictionaryEntry[]>();
  const wordsToFindInDb: string[] = [];

  for (const w of words) {
    const normalized = w.trim();
    if (!normalized) continue;

    // 1. Hot memory cache
    const cached = dictionaryCache.get(normalized);
    if (cached) {
      result.set(normalized, cached);
      continue;
    }

    // 2. Grammar particles
    if (GRAMMAR_PARTICLES[normalized]) {
      const entry = [GRAMMAR_PARTICLES[normalized]];
      dictionaryCache.set(normalized, entry);
      result.set(normalized, entry);
      continue;
    }

    wordsToFindInDb.push(normalized);
  }

  const uniqueMissingFromMem = Array.from(new Set(wordsToFindInDb));
  const wordsToFetchNetwork: string[] = [];

  // 3. Check IndexedDB in parallel
  if (uniqueMissingFromMem.length > 0) {
    try {
      const db = await dbPromise;
      await Promise.all(
        uniqueMissingFromMem.map(async (word) => {
          try {
            const record = await db.get('dictionary_cache', word);
            if (record && record.entries) {
              dictionaryCache.set(word, record.entries);
              result.set(word, record.entries);
            } else {
              wordsToFetchNetwork.push(word);
            }
          } catch {
            wordsToFetchNetwork.push(word);
          }
        }),
      );
    } catch {
      wordsToFetchNetwork.push(...uniqueMissingFromMem);
    }
  }

  // 4. Batch fetch uncached words from backend API
  const uniqueMissing = Array.from(new Set(wordsToFetchNetwork));

  if (uniqueMissing.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < uniqueMissing.length; i += chunkSize) {
      const chunk = uniqueMissing.slice(i, i + chunkSize);
      try {
        const { data } = await api.post<BatchLookupResponse>(
          '/dictionary/japanese/batch',
          { words: chunk },
          { signal },
        );

        if (data && data.results) {
          const db = await dbPromise.catch(() => null);

          for (const [word, entries] of Object.entries(data.results)) {
            dictionaryCache.set(word, entries);
            result.set(word, entries);

            // Save to IndexedDB
            if (db) {
              db.put(
                'dictionary_cache',
                {
                  word,
                  entries,
                  cachedAt: new Date().toISOString(),
                },
                word,
              ).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('Batch dictionary lookup failed for chunk:', err);
        for (const w of chunk) {
          if (!result.has(w)) {
            result.set(w, []);
          }
        }
      }
    }
  }

  return result;
}