import kuromoji from 'kuromoji';

let tokenizer:
  | kuromoji.Tokenizer<kuromoji.IpadicFeatures>
  | null = null;

let initializationPromise:
  | Promise<
      kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null
    >
  | null = null;

function initializeTokenizer(
  dictionaryPath: string,
) {
  if (tokenizer) {
    return Promise.resolve(tokenizer);
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise =
    new Promise((resolve) => {
      kuromoji
        .builder({
          dicPath: dictionaryPath,
        })
        .build((error, result) => {
          if (error) {
            console.error(
              'Kuromoji initialization failed',
              error,
            );

            resolve(null);
            return;
          }

          tokenizer = result;

          resolve(result);
        });
    });

  return initializationPromise;
}

function fallbackTokenize(
  text: string,
) {
  const parts =
    text.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+|[A-Za-z0-9]+|[^\p{L}\p{N}\s]/gu,
    ) ?? [];

  return parts.map(
    (surface, index) => ({
      id: `fallback-${index}`,
      surface,
      lemma: surface,
      dictionaryForm: surface,
      isWordLike:
        /[\p{L}\p{N}]/u.test(
          surface,
        ),
    }),
  );
}

self.onmessage = async (
  event: MessageEvent,
) => {
  const {
    id,
    type,
    payload,
  } = event.data ?? {};

  try {
    if (type === 'INIT') {
      await initializeTokenizer(
        payload?.dictPath ?? '/dict/',
      );

      self.postMessage({
        type: 'INIT_SUCCESS',
      });

      return;
    }

    if (type !== 'TOKENIZE') {
      return;
    }

    const text =
      payload?.text ?? '';

    if (!tokenizer) {
      self.postMessage({
        id,
        type: 'TOKENIZE_SUCCESS',
        payload:
          fallbackTokenize(text),
      });

      return;
    }

    const rawTokens =
      tokenizer.tokenize(text);

    const tokens =
      rawTokens.map(
        (token, index) => {
          const features =
            token;

          const surface =
            features.surface_form;

          const dictionaryForm =
            features.basic_form !== '*'
              ? features.basic_form
              : surface;

          const reading =
            features.reading !== '*'
              ? features.reading
              : undefined;

          const partOfSpeech =
            [
              features.pos,
              features.pos_detail_1,
            ]
              .filter(
                Boolean,
              )
              .join(',');

          return {
            id: `token-${index}`,

            surface,

            lemma:
              dictionaryForm,

            dictionaryForm,

            reading,

            partOfSpeech,

            isWordLike:
              features.pos !==
              '記号',
          };
        },
      );

    self.postMessage({
      id,
      type: 'TOKENIZE_SUCCESS',
      payload: tokens,
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
};