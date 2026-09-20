import type { LocalBook } from '../../types/book';
import type {
  ComplexityTier,
  LanguageComplexityAnalyzer,
  VocabularyComplexityProfile,
} from './types';

/**
 * Generic Lexical Complexity Analyzer for non-kanji languages (English, German, Portuguese, etc.)
 *
 * Uses structural and lexical readability metrics:
 * 1. Average Sentence Length (ASL)
 * 2. Lexical Richness (Type-Token Ratio / TTR)
 * 3. Polysyllabic & Long-Word Density (>= 7-8 characters)
 *
 * Designed with a modular slot for CEFR Top 5,000 Frequency Lexicons.
 */
export class GenericComplexityAnalyzer implements LanguageComplexityAnalyzer {
  readonly language: string;

  constructor(language: string = 'english') {
    this.language = language;
  }

  analyze(
    book: LocalBook,
    knownWordsSet?: Set<string>
  ): VocabularyComplexityProfile {
    const uniqueWordsSet = new Set<string>();
    let totalWordTokens = 0;
    let totalSentences = 0;
    let totalCharacters = 0;
    let longWordsCount = 0;

    for (const chapter of book.chapters) {
      for (const paragraph of chapter.paragraphs) {
        for (const sentence of paragraph.sentences) {
          if (sentence.text && sentence.text.trim().length > 0) {
            totalSentences++;
          }

          for (const token of sentence.tokens) {
            const raw = (token.lemma || token.surface || '').trim().toLowerCase();
            // Clean non-alphanumeric punctuation
            const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
            if (word.length > 0 && token.isWordLike !== false) {
              totalWordTokens++;
              totalCharacters += word.length;
              uniqueWordsSet.add(word);

              if (word.length >= 8) {
                longWordsCount++;
              }
            }
          }
        }
      }
    }

    const uniqueWords = uniqueWordsSet.size;
    const safeTotalWords = Math.max(1, totalWordTokens);
    const safeTotalSentences = Math.max(1, totalSentences);

    // Readability Metrics
    const avgSentenceLength = safeTotalWords / safeTotalSentences;
    const avgWordLength = totalCharacters / safeTotalWords;
    const ttr = uniqueWords / safeTotalWords; // Type-Token Ratio
    const longWordRatio = longWordsCount / safeTotalWords;

    // Score calculation (1.0 to 10.0)
    // ASL: 10 words -> ~2.0, 25 words -> ~6.0, 40+ words -> ~9.0
    let calculatedScore = 2.0;
    calculatedScore += Math.min(3.5, (avgSentenceLength / 25) * 3.5);
    calculatedScore += Math.min(2.5, (longWordRatio / 0.25) * 2.5);
    calculatedScore += Math.min(2.0, (ttr / 0.35) * 2.0);

    const score = Math.min(10.0, Math.max(1.0, Math.round(calculatedScore * 10) / 10));

    let levelLabel = 'CEFR A1 (Beginner)';
    if (score >= 8.5) levelLabel = 'CEFR C2 (Mastery)';
    else if (score >= 7.2) levelLabel = 'CEFR C1 (Advanced)';
    else if (score >= 5.5) levelLabel = 'CEFR B2 (Upper Intermediate)';
    else if (score >= 3.8) levelLabel = 'CEFR B1 (Intermediate)';
    else if (score >= 2.5) levelLabel = 'CEFR A2 (Elementary)';

    // Estimated CEFR Distribution
    // (Note: Will be backed by exact Top-5k lemma frequency lists when added)
    const a1Pct = Math.max(10, Math.min(65, Math.round(65 - score * 4.5)));
    const a2Pct = Math.max(10, Math.min(25, Math.round(25 - score * 1.0)));
    const b1Pct = Math.max(5, Math.min(25, Math.round(10 + score * 1.2)));
    const b2Pct = Math.max(5, Math.min(20, Math.round(5 + score * 1.5)));
    const c1c2Pct = Math.max(2, 100 - (a1Pct + a2Pct + b1Pct + b2Pct));

    const distribution: ComplexityTier[] = [
      {
        id: 'a1',
        label: 'A1 (Beginner)',
        shortLabel: 'A1',
        count: Math.round((a1Pct / 100) * uniqueWords),
        percent: a1Pct,
        color: 'emerald',
        bgClass: 'bg-emerald-500',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/20',
        badgeBgClass: 'bg-emerald-500/10',
      },
      {
        id: 'a2',
        label: 'A2 (Elementary)',
        shortLabel: 'A2',
        count: Math.round((a2Pct / 100) * uniqueWords),
        percent: a2Pct,
        color: 'sky',
        bgClass: 'bg-sky-500',
        textClass: 'text-sky-400',
        borderClass: 'border-sky-500/20',
        badgeBgClass: 'bg-sky-500/10',
      },
      {
        id: 'b1',
        label: 'B1 (Intermediate)',
        shortLabel: 'B1',
        count: Math.round((b1Pct / 100) * uniqueWords),
        percent: b1Pct,
        color: 'amber',
        bgClass: 'bg-amber-500',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/20',
        badgeBgClass: 'bg-amber-500/10',
      },
      {
        id: 'b2',
        label: 'B2 (Upper Inter.)',
        shortLabel: 'B2',
        count: Math.round((b2Pct / 100) * uniqueWords),
        percent: b2Pct,
        color: 'purple',
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        borderClass: 'border-purple-500/20',
        badgeBgClass: 'bg-purple-500/10',
      },
      {
        id: 'c1_c2',
        label: 'C1/C2 (Advanced)',
        shortLabel: 'C1+',
        count: Math.round((c1c2Pct / 100) * uniqueWords),
        percent: c1c2Pct,
        color: 'rose',
        bgClass: 'bg-rose-500',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/20',
        badgeBgClass: 'bg-rose-500/10',
      },
    ];

    // Known words calculation
    let knownCount = 0;
    if (knownWordsSet) {
      for (const word of uniqueWordsSet) {
        if (knownWordsSet.has(word)) knownCount++;
      }
    }

    const knownPercentage =
      uniqueWords > 0 ? Math.round((knownCount / uniqueWords) * 100) : 0;

    return {
      language: this.language,
      totalWords: totalWordTokens,
      uniqueWords,
      knownWords: knownCount,
      knownPercentage,
      score,
      levelLabel,
      distribution,
      details: {
        unitName: 'words',
        totalUnits: totalWordTokens,
        uniqueUnits: uniqueWords,
        notes: `Analyzed with lexical readability metrics (ASL: ${avgSentenceLength.toFixed(1)} words/sent, Avg word length: ${avgWordLength.toFixed(1)} chars, TTR: ${(ttr * 100).toFixed(1)}%).`,
      },
    };
  }
}
