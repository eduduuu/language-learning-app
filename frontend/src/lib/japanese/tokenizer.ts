import type { BookLanguage, LocalToken } from '../../types/book';

type PendingRequest = {
  resolve: (tokens: LocalToken[]) => void;
  reject: (error: unknown) => void;
};

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' }
) => {
  segment(input: string): Iterable<{
    segment: string;
    isWordLike?: boolean;
  }>;
};

function fallbackTokenize(text: string, language: BookLanguage): LocalToken[] {
  const Segmenter = (
    Intl as typeof Intl & { Segmenter?: SegmenterConstructor }
  ).Segmenter;

  if (Segmenter) {
    const segmenter = new Segmenter(
      language === 'japanese' ? 'ja' : 'en',
      { granularity: 'word' }
    );

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

class TokenizerWorkerClient {
  private worker: Worker | null = null;
  private started = false;
  private workerUsable = false;
  private messageId = 0;
  private pending = new Map<number, PendingRequest>();

  private startPromise: Promise<boolean> | null = null;

  private async startWorker(): Promise<boolean> {
    if (this.started) return this.workerUsable;
    if (this.startPromise) return this.startPromise;

    this.startPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      let worker: Worker;

      const finish = (usable: boolean) => {
        if (settled) return;
        settled = true;

        this.started = true;
        this.workerUsable = usable;

        if (!usable) {
          try {
            worker.terminate();
          } catch {
            // Ignore termination errors.
          }

          this.worker = null;
        }

        resolve(usable);
      };

      const timer = window.setTimeout(() => {
        console.warn(
          'Tokenizer initialization timed out. EPUB import will use Intl.Segmenter.'
        );
        finish(false);
      }, 5000);

      try {
        worker = new Worker(
          new URL('./tokenize.worker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch (error) {
        window.clearTimeout(timer);
        console.warn(
          'Tokenizer worker is unavailable. EPUB import will use Intl.Segmenter.',
          error
        );
        finish(false);
        return;
      }

      this.worker = worker;

      worker.onmessage = (event: MessageEvent) => {
        const { id, type, payload, error } = event.data ?? {};

        if (type === 'INIT_SUCCESS') {
          window.clearTimeout(timer);
          finish(true);
          return;
        }

        if (type === 'ERROR' && typeof id === 'number') {
          const request = this.pending.get(id);
          if (!request) return;

          this.pending.delete(id);
          request.reject(new Error(error ?? 'Tokenizer worker error'));
          return;
        }

        if (type === 'TOKENIZE_SUCCESS' && typeof id === 'number') {
          const request = this.pending.get(id);
          if (!request) return;

          this.pending.delete(id);
          request.resolve(payload as LocalToken[]);
        }
      };

      worker.onerror = (event) => {
        window.clearTimeout(timer);

        console.warn(
          'Tokenizer worker failed. EPUB import will use Intl.Segmenter.',
          event.message
        );

        for (const [id, request] of this.pending) {
          this.pending.delete(id);
          request.reject(
            new Error(event.message || 'Tokenizer worker failed')
          );
        }

        finish(false);
      };

      worker.postMessage({
        type: 'INIT',
        payload: {
          // Keep this for Kuromoji-enabled builds, but initialization has a
          // hard timeout above so a missing /dict/ can never freeze import.
          dictPath: '/dict/',
        },
      });
    });

    return this.startPromise;
  }

  async tokenize(
    text: string,
    language: BookLanguage = 'japanese'
  ): Promise<LocalToken[]> {
    const usable = await this.startWorker();

    if (!usable || !this.worker) {
      return fallbackTokenize(text, language);
    }

    const id = ++this.messageId;

    try {
      const result = await new Promise<LocalToken[]>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });

        try {
          this.worker!.postMessage({
            id,
            type: 'TOKENIZE',
            payload: { text, language },
          });
        } catch (error) {
          this.pending.delete(id);
          reject(error);
        }
      });

      return result;
    } catch (error) {
      // A single worker failure must not kill an entire EPUB import.
      console.warn(
        'Tokenizer request failed. Falling back to Intl.Segmenter.',
        error
      );

      return fallbackTokenize(text, language);
    }
  }
}

export const tokenizerClient = new TokenizerWorkerClient();
