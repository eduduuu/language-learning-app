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

/* ============================================================
   WORD LOOKUP RECORDING
   ============================================================ */

export interface WordLookupApiResponse {
  word: string;
  lookup_count: number;
}

export async function recordWordLookupApi(
  word: string,
  language: string = 'japanese',
): Promise<WordLookupApiResponse> {
  const { data } = await api.post<WordLookupApiResponse>('/vocab/lookup', {
    word,
    language,
  });
  return data;
}

/* ============================================================
   GRAMMAR & QUIZ ENGINE
   ============================================================ */

export interface GrammarTopic {
  id: string;
  language: string;
  level: string;
  category: string;
  title: string;
  summary: string;
  rule_explanation?: string;
  pattern_regex?: string;
  weight: number;
}

export interface WeakTopic {
  theme: string;
  total: number;
  correct: number;
  accuracy: number;
  rule_explanation?: string;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  topic_id?: string;
  rule_explanation?: string;
  source?: string;
}

export async function getGrammarTopics(
  language: string = 'japanese',
): Promise<GrammarTopic[]> {
  const { data } = await api.get<GrammarTopic[]>('/quiz/topics', {
    params: { language },
  });
  return data;
}

export async function getWeakGrammarTopics(): Promise<WeakTopic[]> {
  const { data } = await api.get<WeakTopic[]>('/quiz/weak-topics');
  return data;
}

export async function generateQuizQuestion(payload: {
  theme: string;
  language?: string;
  complexity?: number;
  topic_id?: string;
  use_preseeded_only?: boolean;
}): Promise<QuizQuestion> {
  const { data } = await api.post<QuizQuestion>('/quiz/generate', {
    language: payload.language || 'japanese',
    theme: payload.theme,
    complexity: payload.complexity ?? 2,
    topic_id: payload.topic_id,
    use_preseeded_only: payload.use_preseeded_only ?? false,
  });
  return data;
}

export async function generateSentenceClozeApi(
  sentence: string,
  language: string = 'japanese',
): Promise<QuizQuestion> {
  const { data } = await api.post<QuizQuestion>('/quiz/cloze', {
    sentence,
    language,
  });
  return data;
}

export async function logQuizAttempt(payload: {
  theme: string;
  language?: string;
  complexity: number;
  is_correct: boolean;
  question_id?: string;
}): Promise<void> {
  await api.post('/quiz/log', {
    language: payload.language || 'japanese',
    theme: payload.theme,
    complexity: payload.complexity,
    is_correct: payload.is_correct,
    question_id: payload.question_id,
  });
}

/* ============================================================
   SRS CARD MANAGEMENT & ANKI
   ============================================================ */

export interface SRSCardUpdatePayload {
  state?: number;
  next_review_date?: string;
  reps?: number;
  stability?: number;
  difficulty?: number;
  lapses?: number;
}

export async function updateSRSCard(
  word: string,
  payload: SRSCardUpdatePayload,
  language = 'japanese'
): Promise<SRSCard> {
  const { data } = await api.patch<SRSCard>(
    `/vocab/cards/${encodeURIComponent(word)}`,
    payload,
    { params: { language } }
  );
  return data;
}

export async function deleteSRSCard(
  word: string,
  language = 'japanese'
): Promise<{ success: boolean; word: string }> {
  const { data } = await api.delete<{ success: boolean; word: string }>(
    `/vocab/cards/${encodeURIComponent(word)}`,
    { params: { language } }
  );
  return data;
}

export async function bulkSRSCardAction(payload: {
  words: string[];
  action: 'mark_new' | 'mark_mastered' | 'reschedule' | 'delete';
  target_date?: string;
  language?: string;
}): Promise<{ affected: number; action: string }> {
  const { data } = await api.post<{ affected: number; action: string }>(
    '/vocab/cards/bulk-action',
    {
      words: payload.words,
      action: payload.action,
      target_date: payload.target_date,
      language: payload.language || 'japanese',
    }
  );
  return data;
}

export interface AnkiCardImportPayload {
  word: string;
  reading?: string;
  meaning?: string;
  sentence?: string;
  state?: number;
  difficulty?: number;
  stability?: number;
  reps?: number;
  lapses?: number;
  next_review_date?: string;
}

export async function importAnkiCardsApi(payload: {
  cards: AnkiCardImportPayload[];
  import_progress?: boolean;
  language?: string;
}): Promise<{ imported_count: number; total_cards: number }> {
  const { data } = await api.post<{ imported_count: number; total_cards: number }>(
    '/vocab/import-anki',
    {
      cards: payload.cards,
      import_progress: payload.import_progress ?? false,
      language: payload.language || 'japanese',
    }
  );
  return data;
}