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