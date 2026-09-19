import type { LocalToken } from '../../types/book';
import { tokenizerClient } from './tokenizer';

export interface LemmatizedWord {
  surface: string;
  lemma: string;
  dictionaryForm: string;
  reading?: string;
  partOfSpeech?: string;
  isWordLike: boolean;
}

export async function lemmatizeJapanese(
  text: string,
): Promise<LemmatizedWord[]> {
  const tokens =
    await tokenizerClient.tokenize(
      text,
      'japanese',
    );

  return tokens.map((token: LocalToken) => ({
    surface: token.surface,
    lemma:
      token.lemma ||
      token.dictionaryForm ||
      token.surface,
    dictionaryForm:
      token.dictionaryForm ||
      token.lemma ||
      token.surface,
    reading: token.reading,
    partOfSpeech: token.partOfSpeech,
    isWordLike:
      token.isWordLike !== false,
  }));
}