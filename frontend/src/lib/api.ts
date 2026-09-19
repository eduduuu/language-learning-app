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

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  const accessToken = session?.access_token;

  if (userId) {
    config.headers.set('x-user-id', userId);
  }

  // Keep sending the JWT. The current backend still uses x-user-id,
  // but this makes the client ready for the JWT-based identity refactor.
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

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
  const { data } = await api.post<RegisterLocalEpubResponse>(
    '/epub/register',
    payload,
  );

  return data;
}

export interface SRSCard {
  word: string;
  language: string;
  state: number;
  difficulty: number;
  stability: number;
  reps: number;
  lapses: number;
  next_review_date: string;
  last_reviewed?: string | null;
}

export interface AddSRSCardRequest {
  word: string;
  language: 'japanese' | 'english';
}

export async function addSRSCard(
  payload: AddSRSCardRequest,
): Promise<SRSCard> {
  const { data } = await api.post<SRSCard>(
    '/vocab/cards',
    payload,
  );

  return data;
}

export async function getSRSCards(
  language: 'japanese' | 'english' = 'japanese',
): Promise<SRSCard[]> {
  const { data } = await api.get<SRSCard[]>(
    '/vocab/cards',
    {
      params: {
        language,
      },
    },
  );

  return data;
}

