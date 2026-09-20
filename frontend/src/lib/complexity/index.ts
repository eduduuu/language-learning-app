import type { LocalBook } from '../../types/book';
import { GenericComplexityAnalyzer } from './generic_analyzer';
import { JapaneseComplexityAnalyzer } from './japanese_analyzer';
import type {
  LanguageComplexityAnalyzer,
  VocabularyComplexityProfile,
} from './types';

export * from './kanji_data';
export * from './types';
export * from './japanese_analyzer';
export * from './generic_analyzer';

/**
 * Factory to retrieve the appropriate complexity analyzer for a given language.
 */
export function getComplexityAnalyzer(
  language: string = 'japanese'
): LanguageComplexityAnalyzer {
  const norm = language.toLowerCase();
  switch (norm) {
    case 'japanese':
    case 'ja':
    case 'jp':
      return new JapaneseComplexityAnalyzer();
    default:
      return new GenericComplexityAnalyzer(norm);
  }
}

/**
 * High-level helper to analyze a book's vocabulary complexity using its configured language.
 */
export function analyzeBookVocabulary(
  book: LocalBook,
  knownWordsSet?: Set<string>
): VocabularyComplexityProfile {
  const analyzer = getComplexityAnalyzer(book.summary.language || 'japanese');
  return analyzer.analyze(book, knownWordsSet);
}
