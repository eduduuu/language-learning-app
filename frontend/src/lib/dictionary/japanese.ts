import { api } from '../api';

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

const dictionaryCache = new Map<
  string,
  DictionaryEntry[]
>();

export async function lookupJapanese(
  word: string,
  signal?: AbortSignal,
): Promise<DictionaryEntry[]> {
  const normalized = word.trim();

  if (!normalized) {
    return [];
  }

  const cached = dictionaryCache.get(normalized);

  if (cached) {
    return cached;
  }

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

  dictionaryCache.set(
    normalized,
    entries,
  );

  return entries;
}

interface BatchLookupResponse {
  results: Record<string, DictionaryEntry[]>;
}

/**
 * Batch lookup multiple Japanese words in parallel via the backend batch endpoint.
 * Results are automatically stored in the local frontend dictionaryCache.
 */
export async function batchLookupJapanese(
  words: string[],
  signal?: AbortSignal,
): Promise<Map<string, DictionaryEntry[]>> {
  const result = new Map<string, DictionaryEntry[]>();
  const missingWords: string[] = [];

  for (const w of words) {
    const normalized = w.trim();
    if (!normalized) continue;

    const cached = dictionaryCache.get(normalized);
    if (cached) {
      result.set(normalized, cached);
    } else {
      missingWords.push(normalized);
    }
  }

  const uniqueMissing = Array.from(new Set(missingWords));

  if (uniqueMissing.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < uniqueMissing.length; i += chunkSize) {
      const chunk = uniqueMissing.slice(i, i + chunkSize);
      try {
        const { data } = await api.post<BatchLookupResponse>(
          '/dictionary/japanese/batch',
          { words: chunk },
          { signal }
        );

        if (data && data.results) {
          for (const [word, entries] of Object.entries(data.results)) {
            dictionaryCache.set(word, entries);
            result.set(word, entries);
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