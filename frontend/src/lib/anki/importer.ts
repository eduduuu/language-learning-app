/**
 * Anki TSV/CSV Importer
 *
 * Parses Anki exported text files (.tsv, .txt, .csv), detects delimiters,
 * identifies columns, and extracts vocabulary with optional FSRS progress.
 */

export interface ParsedAnkiCard {
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
  tags?: string[];
}

export interface ParseAnkiResult {
  cards: ParsedAnkiCard[];
  totalRows: number;
  delimiter: string;
  hasProgressColumns: boolean;
  preview: ParsedAnkiCard[];
}

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 10).filter(Boolean);
  const counts = { '\t': 0, ',': 0, ';': 0 };

  for (const line of firstLines) {
    if (line.startsWith('#')) continue;
    counts['\t'] += (line.match(/\t/g) || []).length;
    counts[','] += (line.match(/,/g) || []).length;
    counts[';'] += (line.match(/;/g) || []).length;
  }

  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) {
    return '\t';
  }
  if (counts[','] >= counts[';'] && counts[','] > 0) {
    return ',';
  }
  if (counts[';'] > 0) {
    return ';';
  }
  return '\t';
}

function cleanCell(cell: string | undefined): string {
  if (!cell) return '';
  let cleaned = cell.trim();
  // Strip enclosing quotes if CSV
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
  }
  // Strip basic HTML tags if any (like <b> or <br>)
  cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[^>]+(>|$)/g, '');
  return cleaned.trim();
}

export function parseAnkiFileContent(content: string): ParseAnkiResult {
  const lines = content.split(/\r?\n/);
  const delimiter = detectDelimiter(content);

  const dataRows: string[][] = [];
  let headerMap: Record<string, number> | null = null;
  let hasProgress = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue; // Skip Anki metadata comments

    const parts = line.split(delimiter).map(cleanCell);
    if (parts.length === 0 || parts.every((p) => !p)) continue;

    // Detect if this is a header row
    const lower = parts.map((p) => p.toLowerCase());
    if (
      !headerMap &&
      (lower.includes('front') ||
        lower.includes('word') ||
        lower.includes('expression') ||
        lower.includes('back') ||
        lower.includes('meaning'))
    ) {
      headerMap = {};
      lower.forEach((col, idx) => {
        headerMap![col] = idx;
      });
      if (
        lower.includes('state') ||
        lower.includes('difficulty') ||
        lower.includes('reps') ||
        lower.includes('duedate')
      ) {
        hasProgress = true;
      }
      continue;
    }

    dataRows.push(parts);
  }

  const cards: ParsedAnkiCard[] = [];

  for (const parts of dataRows) {
    let word = '';
    let reading = '';
    let meaning = '';
    let sentence = '';
    let state: number | undefined;
    let difficulty: number | undefined;
    let stability: number | undefined;
    let reps: number | undefined;
    let lapses: number | undefined;
    let next_review_date: string | undefined;
    let tags: string[] = [];

    if (headerMap) {
      const getCol = (names: string[]) => {
        for (const n of names) {
          if (headerMap![n] !== undefined && parts[headerMap![n]] !== undefined) {
            return parts[headerMap![n]];
          }
        }
        return '';
      };

      word = getCol(['front', 'word', 'expression', 'kanji']);
      meaning = getCol(['back', 'meaning', 'definition', 'english']);
      reading = getCol(['reading', 'kana', 'pronunciation']);
      sentence = getCol(['sentence', 'example', 'context']);

      const stateStr = getCol(['state']);
      if (stateStr !== '') state = parseInt(stateStr, 10);

      const diffStr = getCol(['difficulty']);
      if (diffStr !== '') difficulty = parseFloat(diffStr);

      const stabStr = getCol(['stability']);
      if (stabStr !== '') stability = parseFloat(stabStr);

      const repsStr = getCol(['reps']);
      if (repsStr !== '') reps = parseInt(repsStr, 10);

      const lapsesStr = getCol(['lapses']);
      if (lapsesStr !== '') lapses = parseInt(lapsesStr, 10);

      const dueStr = getCol(['duedate', 'due', 'next_review_date']);
      if (dueStr !== '') next_review_date = dueStr;

      const tagsStr = getCol(['tags', 'tag']);
      if (tagsStr) tags = tagsStr.split(/\s+/).filter(Boolean);
    } else {
      // Positional inference based on column count
      if (parts.length >= 11) {
        // Full export format: Front, Back, Reading, Sentence, State, Diff, Stab, Reps, Lapses, Due, Tags
        hasProgress = true;
        word = parts[0];
        meaning = parts[1];
        reading = parts[2];
        sentence = parts[3];
        state = parseInt(parts[4], 10) || 0;
        difficulty = parseFloat(parts[5]) || 0.0;
        stability = parseFloat(parts[6]) || 0.0;
        reps = parseInt(parts[7], 10) || 0;
        lapses = parseInt(parts[8], 10) || 0;
        next_review_date = parts[9];
        tags = parts[10] ? parts[10].split(/\s+/).filter(Boolean) : [];
      } else if (parts.length === 5) {
        // Front, Back, Reading, Sentence, Tags
        word = parts[0];
        meaning = parts[1];
        reading = parts[2];
        sentence = parts[3];
        tags = parts[4] ? parts[4].split(/\s+/).filter(Boolean) : [];
      } else if (parts.length === 4) {
        word = parts[0];
        meaning = parts[1];
        reading = parts[2];
        sentence = parts[3];
      } else if (parts.length === 3) {
        word = parts[0];
        reading = parts[1];
        meaning = parts[2];
      } else if (parts.length >= 2) {
        word = parts[0];
        meaning = parts[1];
      } else {
        word = parts[0];
      }
    }

    if (word) {
      cards.push({
        word,
        reading: reading || undefined,
        meaning: meaning || undefined,
        sentence: sentence || undefined,
        state,
        difficulty,
        stability,
        reps,
        lapses,
        next_review_date,
        tags,
      });
    }
  }

  return {
    cards,
    totalRows: cards.length,
    delimiter,
    hasProgressColumns: hasProgress,
    preview: cards.slice(0, 5),
  };
}
