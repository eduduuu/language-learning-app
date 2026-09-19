import kuromoji from 'kuromoji';
import type { BookLanguage, LocalToken } from '../../types/book';

let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let initAttempted = false;

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' }
) => {
  segment(input: string): Iterable<{
    segment: string;
    isWordLike?: boolean;
  }>;
};

function getSegmenter(language: BookLanguage): InstanceType<SegmenterConstructor> | null {
  const Segmenter = (
    Intl as typeof Intl & { Segmenter?: SegmenterConstructor }
  ).Segmenter;

  if (!Segmenter) return null;

  return new Segmenter(language === 'japanese' ? 'ja' : 'en', {
    granularity: 'word',
  });
}

function fallbackTokenize(text: string, language: BookLanguage): LocalToken[] {
  const segmenter = getSegmenter(language);

  if (segmenter) {
    return Array.from(segmenter.segment(text)).map((part, index) => ({
      id: `fallback-${index}`,
      surface: part.segment,
      lemma: part.segment,
      dictionaryForm: part.segment,
      isWordLike: part.isWordLike !== false,
    }));
  }

  const parts = text.match(
    language === 'japanese'
      ? /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+|[A-Za-z0-9]+|[^\p{L}\p{N}\s]/gu
      : /[A-Za-z0-9]+|[^\p{L}\p{N}\s]/gu
  ) ?? [];

  return parts.map((surface, index) => ({
    id: `fallback-${index}`,
    surface,
    lemma: surface,
    dictionaryForm: surface,
    isWordLike: /[\p{L}\p{N}]/u.test(surface),
  }));
}

function initTokenizer(dictPath: string) {
  if (tokenizer || initAttempted) return Promise.resolve(tokenizer);

  initAttempted = true;

  return new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null>(
    (resolve) => {
      kuromoji.builder({ dicPath: dictPath }).build((err, built) => {
        if (err) {
          console.warn(
            'Kuromoji dictionary could not be loaded; using Intl.Segmenter.',
            err
          );
          resolve(null);
          return;
        }

        tokenizer = built;
        resolve(built);
      });
    }
  );
}

self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data ?? {};

  try {
    if (type === 'INIT') {
      // INIT must always answer. The client has a 5s timeout as a second
      // safety net for a broken/missing dictionary.
      await initTokenizer(payload?.dictPath ?? '/dict/');
      self.postMessage({ type: 'INIT_SUCCESS' });
      return;
    }

    if (type !== 'TOKENIZE') return;

    const language: BookLanguage =
      payload?.language === 'english' ? 'english' : 'japanese';

    if (language === 'japanese' && tokenizer) {
      const tokens = tokenizer.tokenize(payload.text);

      self.postMessage({
        id,
        type: 'TOKENIZE_SUCCESS',
        payload: tokens.map((token, index) => ({
          id: `worker-${index}`,
          surface: token.surface_form,
          lemma:
            token.basic_form !== '*' ? token.basic_form : token.surface_form,
          dictionaryForm:
            token.basic_form !== '*' ? token.basic_form : token.surface_form,
          isWordLike: token.pos !== '記号',
        })),
      });

      return;
    }

    self.postMessage({
      id,
      type: 'TOKENIZE_SUCCESS',
      payload: fallbackTokenize(payload.text, language),
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
