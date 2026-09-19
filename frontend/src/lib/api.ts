import axios from 'axios';
import { supabase } from './supabase';

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'http://127.0.0.1:8080/api/v1',

  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;
    const accessToken = session?.access_token;

    if (userId) {
      config.headers.set('x-user-id', userId);
    }

    if (accessToken) {
      config.headers.set(
        'Authorization',
        `Bearer ${accessToken}`,
      );
    }

    return config;
  },
);

/* ============================================================
   EPUB REGISTRATION
   ============================================================ */

export interface RegisterVocabularyItem {
  lemma: string;
  surface?: string;
  occurrences: number;
}

export interface RegisterUnit {
  unit_number: number;
  vocabulary: RegisterVocabularyItem[];
}

export interface RegisterLocalEpubRequest {
  fingerprint: string;
  title: string;
  language: 'japanese' | 'english';
  total_unique_words: number;
  units: RegisterUnit[];
}

export interface RegisterLocalEpubResponse {
  book_id: string;
  title: string;
  language: string;
  fingerprint: string;
  created: boolean;
  total_unique_words: number;
  units_registered: number;
  registered_at: string;
}

export async function registerLocalEpub(
  payload: RegisterLocalEpubRequest,
): Promise<RegisterLocalEpubResponse> {
  const { data } =
    await api.post<RegisterLocalEpubResponse>(
      '/epub/register',
      payload,
    );

  return data;
}

/* ============================================================
   BOOKS
   ============================================================ */

export interface SavedBook {
  id: string;
  title: string;
  language: 'japanese' | 'english';
  cover_url?: string | null;
}

export async function getBooks(): Promise<SavedBook[]> {
  const { data } =
    await api.get<SavedBook[]>(
      '/epub/books',
    );

  return data;
}

export interface BookProgress {
  book_id: string;
  total_words: number;
  learned_words: number;
  mastery: number;
}

export async function getBookProgress(
  bookId: string,
): Promise<BookProgress> {
  const { data } =
    await api.get<BookProgress>(
      `/epub/books/${bookId}/progress`,
    );

  return data;
}

/* ============================================================
   SRS
   ============================================================ */

export interface SRSCard {
  word: string;

  language:
    | 'japanese'
    | 'english';

  state: number;

  difficulty: number;

  stability: number;

  reps: number;

  lapses: number;

  next_review_date: string;

  last_reviewed?:
    | string
    | null;
}

export interface AddSRSCardRequest {
  word: string;

  language:
    | 'japanese'
    | 'english';
}

export async function addSRSCard(
  payload: AddSRSCardRequest,
): Promise<SRSCard> {
  const { data } =
    await api.post<SRSCard>(
      '/vocab/cards',
      payload,
    );

  return data;
}

export async function getSRSCards(
  language:
    | 'japanese'
    | 'english' = 'japanese',
): Promise<SRSCard[]> {
  const { data } =
    await api.get<SRSCard[]>(
      '/vocab/cards',
      {
        params: {
          language,
        },
      },
    );

  return data;
}

/* ============================================================
   VOCABULARY GENERATION
   ============================================================ */

export interface VocabWordDetail {
  base_word: string;
  conjugated_word: string;
  reading: string;
  meaning: string;
}

export interface VocabGenerateRequest {
  mode: 'jlpt' | 'books';

  sentence_mode: 'book' | 'ai';

  language: 'japanese' | 'english';

  jlpt_level?: string;

  book_id?: string;

  start_page?: number;

  end_page?: number;

  sentence_max_words: number;

  kanji_density: number;

  target_vocab_count: number;
}

export interface AIVocabResponse {
  words: string[];
  sentence: string;
  translation: string;
  word_details: VocabWordDetail[];
}

export interface BookVocabResponse {
  words: string[];
  book_id: string;
  sentence_mode: 'book';
}

export type VocabGenerateResponse =
  | AIVocabResponse
  | BookVocabResponse;

export async function generateVocabulary(
  payload: VocabGenerateRequest,
): Promise<VocabGenerateResponse> {
  const { data } =
    await api.post<VocabGenerateResponse>(
      '/vocab/generate',
      payload,
    );

  return data;
}

/* ============================================================
   BOOK SENTENCE ENRICHMENT
   ============================================================ */

export interface EnrichBookSentenceRequest {
  sentence: string;
  words: string[];
}

export interface EnrichBookSentenceResponse {
  translation: string;
  word_details: VocabWordDetail[];
}

export async function enrichBookSentence(
  payload: EnrichBookSentenceRequest,
): Promise<EnrichBookSentenceResponse> {
  const { data } =
    await api.post<EnrichBookSentenceResponse>(
      '/vocab/enrich-book-sentence',
      payload,
    );

  return data;
}

/* ============================================================
   SENTENCE TRANSLATION
   ============================================================ */

export interface TranslateSentenceRequest {
  sentence: string;
  language: 'japanese' | 'english';
}

export interface TranslateSentenceResponse {
  translation: string;
}

export async function translateSentence(
  payload: TranslateSentenceRequest,
): Promise<TranslateSentenceResponse> {
  const { data } =
    await api.post<TranslateSentenceResponse>(
      '/vocab/translate-sentence',
      payload,
    );

  return data;
}

/* ============================================================
   VOCABULARY REVIEW
   ============================================================ */

export async function reviewVocabularyCard(
  word: string,
  language: 'japanese' | 'english',
  rating:
    | 'very_hard'
    | 'hard'
    | 'ok'
    | 'good',
) {
  const { data } =
    await api.post(
      '/vocab/review',
      {
        word,
        language,
        rating,
      },
    );

  return data;
}