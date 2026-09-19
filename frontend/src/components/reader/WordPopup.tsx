export interface DictionarySense {
  englishDefinitions: string[];
  partsOfSpeech: string[];
}

export interface JapaneseDictionaryEntry {
  word: string;
  reading?: string;
  senses: DictionarySense[];
}

interface JishoResponse {
  data: Array<{
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

const cache = new Map<
  string,
  JapaneseDictionaryEntry[]
>();

export async function lookupJapanese(
  word: string,
): Promise<JapaneseDictionaryEntry[]> {
  const normalized =
    word.trim();

  if (!normalized) {
    return [];
  }

  const cached =
    cache.get(normalized);

  if (cached) {
    return cached;
  }

  const url =
    `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(
      normalized,
    )}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Dictionary request failed: ${response.status}`,
    );
  }

  const json =
    (await response.json()) as JishoResponse;

  const entries =
    json.data.map(
      (entry) => ({
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
                sense.english_definitions ??
                [],

              partsOfSpeech:
                sense.parts_of_speech ??
                [],
            })),
      }),
    );

  cache.set(
    normalized,
    entries,
  );

  return entries;
}