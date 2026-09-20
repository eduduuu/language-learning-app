import type { LocalBook } from '../../types/book';

export interface ComplexityTier {
  id: string;          // e.g. 'n5' | 'n4' | 'n3' | 'n2' | 'n1' | 'n1_plus' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
  label: string;       // e.g. 'N5 (Beginner)' or 'A1 (Beginner)'
  shortLabel: string;  // e.g. 'N5' or 'A1'
  count: number;
  percent: number;
  color: string;       // e.g. 'emerald' | 'sky' | 'amber' | 'purple' | 'indigo' | 'rose'
  bgClass: string;     // Tailwind background class e.g. 'bg-emerald-500'
  textClass: string;   // Tailwind text class e.g. 'text-emerald-400'
  borderClass: string; // Tailwind border class e.g. 'border-emerald-500/20'
  badgeBgClass: string;// Tailwind badge bg class e.g. 'bg-emerald-500/10'
}

export interface ComplexityDetails {
  unitName: string;    // 'kanji' | 'words'
  totalUnits: number;  // e.g. total kanji tokens or total word tokens
  uniqueUnits: number; // e.g. unique kanji count or unique lemmas
  notes?: string;
  [key: string]: any;
}

export interface VocabularyComplexityProfile {
  language: string;
  totalWords: number;
  uniqueWords: number;
  knownWords: number;
  knownPercentage: number;
  score: number;             // 1.0 to 10.0
  levelLabel: string;        // e.g. 'JLPT N2 (Upper Intermediate)' or 'CEFR B2 (Upper Intermediate)'
  distribution: ComplexityTier[];
  details: ComplexityDetails;

  // Convenience and backwards-compatibility aliases
  vocabComplexityScore?: number;
  vocabLevelLabel?: string;
  uniqueKanji?: number;
  totalKanji?: number;
}

export interface LanguageComplexityAnalyzer {
  readonly language: string;
  analyze(book: LocalBook, knownWordsSet?: Set<string>): VocabularyComplexityProfile;
}
