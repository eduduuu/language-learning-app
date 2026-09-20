import type { LocalBook } from '../../types/book';
import {
  N1_KANJI,
  N2_KANJI,
  N3_KANJI,
  N4_KANJI,
  N5_KANJI,
} from './kanji_data';
import type {
  ComplexityTier,
  LanguageComplexityAnalyzer,
  VocabularyComplexityProfile,
} from './types';

export class JapaneseComplexityAnalyzer implements LanguageComplexityAnalyzer {
  readonly language = 'japanese';

  analyze(
    book: LocalBook,
    knownWordsSet?: Set<string>
  ): VocabularyComplexityProfile {
    const uniqueWordsSet = new Set<string>();
    const kanjiList: string[] = [];
    let totalWordTokens = 0;

    for (const chapter of book.chapters) {
      for (const paragraph of chapter.paragraphs) {
        for (const sentence of paragraph.sentences) {
          for (const token of sentence.tokens) {
            if (token.isWordLike !== false) {
              totalWordTokens++;
              const lemma = (token.lemma || token.dictionaryForm || token.surface).trim();
              if (lemma) {
                uniqueWordsSet.add(lemma);
              }
            }

            // Extract kanji characters
            const surface = token.surface || '';
            const matches = surface.match(/[\u4E00-\u9FAF]/g);
            if (matches) {
              for (const k of matches) {
                kanjiList.push(k);
              }
            }
          }
        }
      }
    }

    const uniqueKanjiSet = new Set(kanjiList);
    const totalUniqueKanji = Math.max(1, uniqueKanjiSet.size);

    let n5Count = 0;
    let n4Count = 0;
    let n3Count = 0;
    let n2Count = 0;
    let n1Count = 0;
    let n1PlusCount = 0;

    for (const k of uniqueKanjiSet) {
      if (N5_KANJI.has(k)) {
        n5Count++;
      } else if (N4_KANJI.has(k)) {
        n4Count++;
      } else if (N3_KANJI.has(k)) {
        n3Count++;
      } else if (N2_KANJI.has(k)) {
        n2Count++;
      } else if (N1_KANJI.has(k)) {
        n1Count++;
      } else {
        n1PlusCount++;
      }
    }

    const n5Pct = Math.round((n5Count / totalUniqueKanji) * 100);
    const n4Pct = Math.round((n4Count / totalUniqueKanji) * 100);
    const n3Pct = Math.round((n3Count / totalUniqueKanji) * 100);
    const n2Pct = Math.round((n2Count / totalUniqueKanji) * 100);
    const n1Pct = Math.round((n1Count / totalUniqueKanji) * 100);
    const n1PlusPct = Math.round((n1PlusCount / totalUniqueKanji) * 100);

    const distribution: ComplexityTier[] = [
      {
        id: 'n5',
        label: 'N5 (Beginner)',
        shortLabel: 'N5',
        count: n5Count,
        percent: n5Pct,
        color: 'emerald',
        bgClass: 'bg-emerald-500',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/20',
        badgeBgClass: 'bg-emerald-500/10',
      },
      {
        id: 'n4',
        label: 'N4 (Elementary)',
        shortLabel: 'N4',
        count: n4Count,
        percent: n4Pct,
        color: 'sky',
        bgClass: 'bg-sky-500',
        textClass: 'text-sky-400',
        borderClass: 'border-sky-500/20',
        badgeBgClass: 'bg-sky-500/10',
      },
      {
        id: 'n3',
        label: 'N3 (Intermediate)',
        shortLabel: 'N3',
        count: n3Count,
        percent: n3Pct,
        color: 'amber',
        bgClass: 'bg-amber-500',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/20',
        badgeBgClass: 'bg-amber-500/10',
      },
      {
        id: 'n2',
        label: 'N2 (Upper Inter.)',
        shortLabel: 'N2',
        count: n2Count,
        percent: n2Pct,
        color: 'purple',
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        borderClass: 'border-purple-500/20',
        badgeBgClass: 'bg-purple-500/10',
      },
      {
        id: 'n1',
        label: 'N1 (Advanced)',
        shortLabel: 'N1',
        count: n1Count,
        percent: n1Pct,
        color: 'indigo',
        bgClass: 'bg-indigo-500',
        textClass: 'text-indigo-400',
        borderClass: 'border-indigo-500/20',
        badgeBgClass: 'bg-indigo-500/10',
      },
      {
        id: 'n1_plus',
        label: 'N1+ (Rare/Literary)',
        shortLabel: 'N1+',
        count: n1PlusCount,
        percent: n1PlusPct,
        color: 'rose',
        bgClass: 'bg-rose-500',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/20',
        badgeBgClass: 'bg-rose-500/10',
      },
    ];

    // Weighted Kanji Complexity
    // N5: 1.5, N4: 3.0, N3: 5.2, N2: 7.2, N1: 8.8, N1+: 9.6
    const weightedSum =
      n5Count * 1.5 +
      n4Count * 3.0 +
      n3Count * 5.2 +
      n2Count * 7.2 +
      n1Count * 8.8 +
      n1PlusCount * 9.6;

    const rawScore = weightedSum / totalUniqueKanji;
    const score = Math.min(10.0, Math.max(1.0, Math.round(rawScore * 10) / 10));

    let levelLabel = 'JLPT N5 (Beginner)';
    if (score >= 8.2) levelLabel = 'JLPT N1 (Advanced)';
    else if (score >= 6.2) levelLabel = 'JLPT N2 (Upper Intermediate)';
    else if (score >= 4.2) levelLabel = 'JLPT N3 (Intermediate)';
    else if (score >= 2.5) levelLabel = 'JLPT N4 (Elementary)';

    // Known words calculation
    let knownCount = 0;
    if (knownWordsSet) {
      for (const word of uniqueWordsSet) {
        if (knownWordsSet.has(word)) knownCount++;
      }
    }

    const uniqueWords = uniqueWordsSet.size;
    const knownPercentage =
      uniqueWords > 0 ? Math.round((knownCount / uniqueWords) * 100) : 0;

    return {
      language: 'japanese',
      totalWords: totalWordTokens,
      uniqueWords,
      knownWords: knownCount,
      knownPercentage,
      score,
      levelLabel,
      vocabComplexityScore: score,
      vocabLevelLabel: levelLabel,
      uniqueKanji: uniqueKanjiSet.size,
      totalKanji: kanjiList.length,
      distribution,
      details: {
        unitName: 'kanji',
        totalUnits: kanjiList.length,
        uniqueUnits: uniqueKanjiSet.size,
        notes:
          'Evaluated against all 2,136 official Jōyō Kanji across JLPT N5 through N1, plus literary Hyōgai characters.',
      },
    };
  }
}
