import type { LocalBook } from '../../types/book';

export interface GrammarPattern {
  id: string;
  name: string;
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  category: 'verbs' | 'conditionals' | 'modality' | 'keigo';
  regex: RegExp;
  weight: number; // 1.0 to 10.0
}

// Discriminating grammar patterns (excluding universal baseline particles like は/が/を/に so they don't drown out difficulty)
export const JAPANESE_GRAMMAR_PATTERNS: GrammarPattern[] = [
  // N5 Patterns (Weight 1.0 - 2.5)
  { id: 'n5-masu', name: '〜ます / 〜ました (Polite)', level: 'N5', category: 'verbs', regex: /[^\s]+(ます|ました|ません|ませんでした)/, weight: 1.5 },
  { id: 'n5-te-kudasai', name: '〜てください (Polite Request)', level: 'N5', category: 'verbs', regex: /[^\s]+(て|で)ください/, weight: 1.8 },
  { id: 'n5-tai', name: '〜たい (Desire)', level: 'N5', category: 'verbs', regex: /[^\s]+たい(です)?/, weight: 2.0 },

  // N4 Patterns (Weight 2.5 - 4.5)
  { id: 'n4-te-iru', name: '〜ている (Ongoing / Resulting State)', level: 'N4', category: 'verbs', regex: /[^\s]+(て|で)いる/, weight: 3.0 },
  { id: 'n4-tara', name: '〜たら (Conditional)', level: 'N4', category: 'conditionals', regex: /[^\s]+たら/, weight: 3.5 },
  { id: 'n4-nara', name: '〜なら (Contextual Condition)', level: 'N4', category: 'conditionals', regex: /[^\s]+なら/, weight: 3.5 },
  { id: 'n4-potential', name: 'Potential Form (〜られる / 〜る)', level: 'N4', category: 'verbs', regex: /[^\s]+(られる|飲める|行ける|話せる|買える|読める|走れる|見られる)/, weight: 3.8 },
  { id: 'n4-te-oku', name: '〜ておく / 〜とく (Preparation)', level: 'N4', category: 'verbs', regex: /[^\s]+(ておく|とおく|とく|どく)/, weight: 3.8 },
  { id: 'n4-giving', name: 'Giving / Receiving (あげる / くれる / もらう)', level: 'N4', category: 'modality', regex: /[^\s]+(てあげる|てくれる|てもらう)/, weight: 4.0 },
  { id: 'n4-sou-da', name: '〜そうだ (Looks like / Hearsay)', level: 'N4', category: 'modality', regex: /[^\s]+(そうだ|そうです)/, weight: 4.0 },

  // N3 Patterns (Weight 4.5 - 6.5)
  { id: 'n3-ba', name: '〜ば (Conditional)', level: 'N3', category: 'conditionals', regex: /[^\s]+(えば|けば|せば|てば|ねば|べば|めば|れば|ければ)/, weight: 4.8 },
  { id: 'n3-passive', name: 'Passive Voice (〜れる / 〜られる)', level: 'N3', category: 'verbs', regex: /[^\s]+(れる|られる|された)/, weight: 5.2 },
  { id: 'n3-causative', name: 'Causative Voice (〜せる / 〜させる)', level: 'N3', category: 'verbs', regex: /[^\s]+(せる|させる|させた)/, weight: 5.5 },
  { id: 'n3-wake', name: '〜わけ (Reason / Explanation)', level: 'N3', category: 'modality', regex: /[^\s]+(わけだ|わけがない|わけではない)/, weight: 5.8 },
  { id: 'n3-hazu', name: '〜はず (Expectation)', level: 'N3', category: 'modality', regex: /[^\s]+(はずだ|はずがない)/, weight: 5.5 },
  { id: 'n3-keigo', name: 'Keigo Basics (いらっしゃる / 参る / なさる)', level: 'N3', category: 'keigo', regex: /[^\s]+(いらっしゃる|おっしゃる|なさる|参る|申す|いたす)/, weight: 6.5 },

  // N2-N1 Patterns (Weight 6.5 - 9.5)
  { id: 'n2-causative-passive', name: 'Causative-Passive (〜させられる)', level: 'N2', category: 'verbs', regex: /[^\s]+(させられる|される|させられた)/, weight: 7.5 },
  { id: 'n2-mono-da', name: '〜ものだ / 〜ことだ', level: 'N2', category: 'modality', regex: /[^\s]+(ものだ|ものではない|ことだ)/, weight: 7.2 },
  { id: 'n1-literary', name: 'Literary / Formal Expressions (〜ざるを得ない / 〜ごとき)', level: 'N1', category: 'modality', regex: /[^\s]+(ざるを得ない|ごとき|まじき|たるもの)/, weight: 9.0 },
];

export interface DetectedPatternStat {
  patternId: string;
  name: string;
  level: string;
  category: string;
  count: number;
}

export interface BookGrammarProfile {
  difficultyScore: number; // 1.0 to 10.0
  levelLabel: 'N5 (Beginner)' | 'N4 (Elementary)' | 'N3 (Intermediate)' | 'N2 (Upper Intermediate)' | 'N1 (Advanced)';
  totalScannedSentences: number;
  detectedPatterns: DetectedPatternStat[];
  topGrammarThemes: string[];
}

export function scanSentencesForGrammar(sentences: string[]): BookGrammarProfile {
  if (!sentences || sentences.length === 0) {
    return {
      difficultyScore: 1.0,
      levelLabel: 'N5 (Beginner)',
      totalScannedSentences: 0,
      detectedPatterns: [],
      topGrammarThemes: [],
    };
  }

  const counts: Record<string, number> = {};
  JAPANESE_GRAMMAR_PATTERNS.forEach((p) => (counts[p.id] = 0));

  for (const sentence of sentences) {
    for (const pattern of JAPANESE_GRAMMAR_PATTERNS) {
      if (pattern.regex.test(sentence)) {
        counts[pattern.id] = (counts[pattern.id] || 0) + 1;
      }
    }
  }

  const detectedList: DetectedPatternStat[] = [];
  let n4Hits = 0;
  let n3Hits = 0;
  let n2n1Hits = 0;

  for (const pattern of JAPANESE_GRAMMAR_PATTERNS) {
    const c = counts[pattern.id] || 0;
    if (c > 0) {
      if (pattern.level === 'N4') n4Hits += c;
      if (pattern.level === 'N3') n3Hits += c;
      if (pattern.level === 'N2' || pattern.level === 'N1') n2n1Hits += c;

      detectedList.push({
        patternId: pattern.id,
        name: pattern.name,
        level: pattern.level,
        category: pattern.category,
        count: c,
      });
    }
  }

  detectedList.sort((a, b) => b.count - a.count);

  // Density per 100 sentences
  const n = Math.max(1, sentences.length);
  const n4Density = (n4Hits / n) * 100;
  const n3Density = (n3Hits / n) * 100;
  const n2n1Density = (n2n1Hits / n) * 100;

  // Base difficulty starts at 2.0 (basic Japanese syntax)
  // Higher level pattern density scales the difficulty up to 10.0
  let calculatedScore = 2.0;
  calculatedScore += Math.min(2.5, n4Density * 0.15);     // up to +2.5 for N4
  calculatedScore += Math.min(3.0, n3Density * 0.25);     // up to +3.0 for N3
  calculatedScore += Math.min(2.5, n2n1Density * 0.35);   // up to +2.5 for N2/N1

  const score = Math.min(10.0, Math.max(1.0, Math.round(calculatedScore * 10) / 10));

  let levelLabel: BookGrammarProfile['levelLabel'] = 'N5 (Beginner)';
  if (score >= 7.5) levelLabel = 'N1 (Advanced)';
  else if (score >= 6.0) levelLabel = 'N2 (Upper Intermediate)';
  else if (score >= 4.0) levelLabel = 'N3 (Intermediate)';
  else if (score >= 2.5) levelLabel = 'N4 (Elementary)';

  return {
    difficultyScore: score,
    levelLabel,
    totalScannedSentences: sentences.length,
    detectedPatterns: detectedList,
    topGrammarThemes: detectedList.slice(0, 4).map((d) => `${d.name} (${d.count}×)`),
  };
}

export function scanBookGrammar(book: LocalBook): BookGrammarProfile {
  const allSentences: string[] = [];
  for (const chapter of book.chapters) {
    for (const p of chapter.paragraphs) {
      for (const s of p.sentences) {
        if (s.text && s.text.trim().length > 3) {
          allSentences.push(s.text.trim());
        }
      }
    }
  }
  return scanSentencesForGrammar(allSentences);
}

// Re-export modular vocabulary & lexical complexity analyzer
export {
  analyzeBookVocabulary,
  getComplexityAnalyzer,
  JapaneseComplexityAnalyzer,
  GenericComplexityAnalyzer,
} from '../complexity';

export type {
  VocabularyComplexityProfile,
  VocabularyComplexityProfile as BookVocabularyProfile,
  ComplexityTier,
  LanguageComplexityAnalyzer,
} from '../complexity';

