import type { LocalBook, LocalToken } from '../../types/book';
import type { QuizQuestion } from '../api';
import { JAPANESE_GRAMMAR_PATTERNS, type GrammarPattern } from './scanner';

// ==============================================================================
// 1. JAPANESE VERB CONJUGATION ENGINE
// ==============================================================================

type VerbGroup = 'ichidan' | 'godan' | 'irregular';

interface VerbConjugationForms {
  lemma: string;
  group: VerbGroup;
  teForm: string;
  politePast: string;
  potential: string;
  passive: string;
  negative: string;
}

// Common Godan verbs ending in -iru / -eru
const GODAN_EXCEPTIONS = new Set([
  '帰る', '入る', '走る', '知る', '切る', '要る', '減る', '焦る', '限る', '握る', '滑る',
]);

export function classifyVerb(lemma: string): VerbGroup {
  if (lemma === 'する' || lemma.endsWith('する') || lemma === '為る') return 'irregular';
  if (lemma === 'くる' || lemma === '来る') return 'irregular';

  if (GODAN_EXCEPTIONS.has(lemma)) return 'godan';

  if (lemma.endsWith('る') && lemma.length >= 2) {
    const penultimate = lemma.charCodeAt(lemma.length - 2);
    // Rough check for i/e sound before ru in hiragana (3040-309F)
    const penChar = lemma[lemma.length - 2];
    const isISound = /[いきしちにひみり]/.test(penChar);
    const isESound = /[えけせてねへめれ]/.test(penChar);
    if (isISound || isESound) {
      return 'ichidan';
    }
  }

  return 'godan';
}

export function conjugateVerb(lemma: string): VerbConjugationForms {
  const group = classifyVerb(lemma);

  if (group === 'irregular') {
    if (lemma === 'くる' || lemma === '来る') {
      return {
        lemma,
        group,
        teForm: lemma === '来る' ? '来て' : 'きて',
        politePast: lemma === '来る' ? '来ました' : 'きました',
        potential: lemma === '来る' ? '来られる' : 'こられる',
        passive: lemma === '来る' ? '来られる' : 'こられる',
        negative: lemma === '来る' ? '来ない' : 'こない',
      };
    }
    // する or compound-する
    const prefix = lemma.slice(0, -2);
    return {
      lemma,
      group,
      teForm: prefix + 'して',
      politePast: prefix + 'しました',
      potential: prefix + 'できる',
      passive: prefix + 'される',
      negative: prefix + 'しない',
    };
  }

  if (group === 'ichidan') {
    const stem = lemma.slice(0, -1);
    return {
      lemma,
      group,
      teForm: stem + 'て',
      politePast: stem + 'ました',
      potential: stem + 'られる',
      passive: stem + 'られる',
      negative: stem + 'ない',
    };
  }

  // Godan conjugations
  const stem = lemma.slice(0, -1);
  const lastChar = lemma[lemma.length - 1];

  let teForm = stem;
  let politePast = stem;
  let potential = stem;
  let passive = stem;
  let negative = stem;

  switch (lastChar) {
    case 'く':
      teForm += lemma === '行く' || lemma === 'いく' ? 'って' : 'いて';
      politePast += 'きました';
      potential += 'ける';
      passive += 'かれる';
      negative += 'かない';
      break;
    case 'ぐ':
      teForm += 'いで';
      politePast += 'ぎました';
      potential += 'げる';
      passive += 'がれる';
      negative += 'がない';
      break;
    case 'す':
      teForm += 'して';
      politePast += 'しました';
      potential += 'せる';
      passive += 'される';
      negative += 'さない';
      break;
    case 'つ':
      teForm += 'って';
      politePast += 'ちました';
      potential += 'てる';
      passive += 'たれる';
      negative += 'たない';
      break;
    case 'ぬ':
      teForm += 'んで';
      politePast += 'にました';
      potential += 'ねる';
      passive += 'なれる';
      negative += 'なない';
      break;
    case 'ぶ':
      teForm += 'んで';
      politePast += 'びました';
      potential += 'べる';
      passive += 'ばれる';
      negative += 'ばない';
      break;
    case 'む':
      teForm += 'んで';
      politePast += 'みました';
      potential += 'める';
      passive += 'まれる';
      negative += 'まない';
      break;
    case 'る':
      teForm += 'って';
      politePast += 'りました';
      potential += 'れる';
      passive += 'られる';
      negative += 'らない';
      break;
    case 'う':
    default:
      teForm += 'って';
      politePast += 'いました';
      potential += 'える';
      passive += 'われる';
      negative += 'わない';
      break;
  }

  return {
    lemma,
    group,
    teForm,
    politePast,
    potential,
    passive,
    negative,
  };
}

/**
 * Extract all distinct Japanese verbs from a LocalBook.
 */
export function extractVerbsFromBook(book: LocalBook): string[] {
  const verbsSet = new Set<string>();

  for (const chapter of book.chapters) {
    for (const p of chapter.paragraphs) {
      for (const s of p.sentences) {
        for (const t of s.tokens) {
          if (t.isWordLike === false) continue;
          const pos = t.partOfSpeech || '';
          if (pos.includes('動詞') || pos.includes('verb')) {
            const lemma = (t.lemma || t.dictionaryForm || '').trim();
            if (lemma && lemma.length >= 2 && /[うくぐすつぬぶむる]$/.test(lemma)) {
              verbsSet.add(lemma);
            }
          }
        }
      }
    }
  }

  return Array.from(verbsSet);
}

/**
 * Generate a multiple-choice verb conjugation question from a verb found in the user's book.
 */
export function generateVerbConjugationQuestion(book: LocalBook): QuizQuestion | null {
  const verbs = extractVerbsFromBook(book);
  if (verbs.length === 0) return null;

  const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];
  const forms = conjugateVerb(randomVerb);

  const targets = [
    {
      name: 'te-form (〜て / 〜で)',
      correct: forms.teForm,
      distractors: [
        forms.group === 'godan' ? randomVerb.slice(0, -1) + 'て' : randomVerb.slice(0, -1) + 'って',
        forms.lemma + 'て',
        forms.politePast.replace('ました', 'て'),
      ],
      rule: `${forms.lemma} is a ${forms.group.toUpperCase()} verb. ${
        forms.group === 'ichidan'
          ? 'Ichidan verbs replace the final る with て.'
          : 'Godan verbs conjugate their final kana based on standard euphonic change (音便).'
      }`,
    },
    {
      name: 'polite past form (〜ました)',
      correct: forms.politePast,
      distractors: [
        randomVerb + 'ました',
        forms.negative.replace('ない', 'ました'),
        forms.teForm.replace(/[てで]$/, 'ました'),
      ],
      rule: `To form the polite past, conjugate the verb into its masu-stem (連用形) and append ました.`,
    },
    {
      name: 'potential form (ability: can do)',
      correct: forms.potential,
      distractors: [
        forms.group === 'godan' ? forms.lemma.slice(0, -1) + 'られる' : forms.lemma.slice(0, -1) + 'れる',
        forms.lemma + 'できる',
        forms.negative.replace('ない', 'れる'),
      ],
      rule: `${
        forms.group === 'ichidan'
          ? 'Ichidan verbs drop る and add られる.'
          : 'Godan verbs shift the final u-vowel to the e-row and append る (e.g. 話す → 話せる).'
      }`,
    },
    {
      name: 'passive form (was done to)',
      correct: forms.passive,
      distractors: [
        forms.potential,
        forms.lemma + 'される',
        forms.teForm + 'いる',
      ],
      rule: `${
        forms.group === 'ichidan'
          ? 'Ichidan verbs drop る and add られる.'
          : 'Godan verbs shift the final u-vowel to the a-row and append れる (e.g. 待つ → 待たれる).'
      }`,
    },
    {
      name: 'plain negative form (〜ない)',
      correct: forms.negative,
      distractors: [
        randomVerb + 'ない',
        forms.teForm.replace(/[てで]$/, 'ない'),
        forms.potential.replace('る', 'ない'),
      ],
      rule: `${
        forms.group === 'ichidan'
          ? 'Ichidan verbs drop る and add ない.'
          : 'Godan verbs shift the final u-vowel to the a-row and add ない (e.g. 買う → 買わない).'
      }`,
    },
  ];

  const target = targets[Math.floor(Math.random() * targets.length)];

  // Deduplicate and shuffle options
  const optionsSet = new Set<string>([target.correct]);
  for (const d of target.distractors) {
    if (d && d !== target.correct) {
      optionsSet.add(d);
    }
  }

  // Fallback if needed to reach 4 options
  let fallbackIndex = 1;
  while (optionsSet.size < 4) {
    optionsSet.add(`${forms.lemma}（変化形${fallbackIndex++}）`);
  }

  const options = Array.from(optionsSet).sort(() => 0.5 - Math.random());
  const correctIndex = options.indexOf(target.correct);

  return {
    question: `In "${book.summary.title}", the verb 「${forms.lemma}」 appears.\nWhat is its ${target.name}?`,
    options,
    correct_option_index: correctIndex,
    explanation: `Correct: 「${target.correct}」\n\n${target.rule}`,
    rule_explanation: target.rule,
    source: 'book_context',
  };
}

// ==============================================================================
// 2. BOOK PATTERN SEARCH & QUESTION GENERATOR
// ==============================================================================

/**
 * Search the chosen book for a sentence matching a specific grammar pattern,
 * and create a contextual cloze question.
 */
export function generatePatternQuestionFromBook(
  book: LocalBook,
  patternIdOrName: string
): QuizQuestion | null {
  // Find pattern by ID or name
  const pattern = JAPANESE_GRAMMAR_PATTERNS.find(
    (p) =>
      p.id.toLowerCase() === patternIdOrName.toLowerCase() ||
      p.name.toLowerCase().includes(patternIdOrName.toLowerCase()) ||
      patternIdOrName.toLowerCase().includes(p.id.toLowerCase())
  );

  if (!pattern) return null;

  // Search sentences in the book matching the regex
  const matches: string[] = [];
  for (const chapter of book.chapters) {
    for (const p of chapter.paragraphs) {
      for (const s of p.sentences) {
        if (s.text && s.text.length >= 10 && s.text.length <= 70) {
          if (pattern.regex.test(s.text)) {
            matches.push(s.text.trim());
          }
        }
      }
    }
  }

  if (matches.length === 0) return null;

  // Pick a random matching sentence
  const sentence = matches[Math.floor(Math.random() * matches.length)];

  // Extract the matching pattern text
  const matchResult = sentence.match(pattern.regex);
  if (!matchResult) return null;

  const matchedString = matchResult[1] || matchResult[0];

  // Distractors based on category
  const distractorsByCategory: Record<string, string[]> = {
    conditionals: ['たら', 'なら', 'ば', 'と', 'ても'],
    verbs: ['ている', 'ておく', 'てある', 'ていく', 'てくる'],
    modality: ['そうだ', 'ようだ', 'らしい', 'はずだ', 'わけだ'],
    keigo: ['いらっしゃる', 'おっしゃる', 'なさる', '参る', '申す'],
  };

  const pool = distractorsByCategory[pattern.category] || ['たら', 'ている', 'そうだ', 'わけだ'];
  const optionsSet = new Set<string>([matchedString]);

  for (const p of pool) {
    if (p !== matchedString) {
      optionsSet.add(p);
    }
  }

  while (optionsSet.size < 4) {
    optionsSet.add(`〜${optionsSet.size + 1}`);
  }

  const options = Array.from(optionsSet).sort(() => 0.5 - Math.random());
  const correctIndex = options.indexOf(matchedString);

  const clozeSentence = sentence.replace(matchedString, '【　】');

  return {
    question: `From "${book.summary.title}":\n\n"${clozeSentence}"\n\nWhich pattern correctly completes this sentence?`,
    options,
    correct_option_index: correctIndex,
    explanation: `Original sentence:\n"${sentence}"\n\nPattern: ${pattern.name} (${pattern.level})\nCategory: ${pattern.category}`,
    rule_explanation: `The pattern ${pattern.name} is used here to convey ${pattern.category}.`,
    source: 'book_context',
  };
}

/**
 * Generate a random question from the user's book (alternating between conjugation, pattern cloze, and particle cloze).
 */
export function generateRandomBookGrammarQuestion(book: LocalBook): QuizQuestion | null {
  const roll = Math.random();

  if (roll < 0.5) {
    const q = generateVerbConjugationQuestion(book);
    if (q) return q;
  }

  // Try finding any pattern from the book
  const shuffledPatterns = [...JAPANESE_GRAMMAR_PATTERNS].sort(() => 0.5 - Math.random());
  for (const pat of shuffledPatterns.slice(0, 8)) {
    const q = generatePatternQuestionFromBook(book, pat.id);
    if (q) return q;
  }

  // Fallback to verb conjugation if pattern search didn't match
  return generateVerbConjugationQuestion(book);
}
