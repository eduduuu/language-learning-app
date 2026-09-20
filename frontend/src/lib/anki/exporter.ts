/**
 * Anki TSV Exporter
 *
 * Formats cards into official Anki-compatible TSV format with headers:
 * #separator:tab
 * #html:true
 *
 * Anki natively recognizes these headers on import without requiring manual field mapping.
 */

export interface ExportCardItem {
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

export interface ExportAnkiOptions {
  withProgress?: boolean;
  deckName?: string;
}

export function formatCardsToAnkiTsv(
  cards: ExportCardItem[],
  options: ExportAnkiOptions = {}
): string {
  const withProgress = !!options.withProgress;
  const deckTag = options.deckName
    ? options.deckName.replace(/\s+/g, '_')
    : 'JapaneseReader';

  const lines: string[] = [
    '#separator:tab',
    '#html:true',
    withProgress ? '#tags column:11' : '#tags column:5',
  ];

  // Header line
  if (withProgress) {
    lines.push(
      [
        'Front',
        'Back',
        'Reading',
        'Sentence',
        'State',
        'Difficulty',
        'Stability',
        'Reps',
        'Lapses',
        'DueDate',
        'Tags',
      ].join('\t')
    );
  } else {
    lines.push(['Front', 'Back', 'Reading', 'Sentence', 'Tags'].join('\t'));
  }

  // Rows
  for (const card of cards) {
    const front = (card.word || '').replace(/[\t\n\r]/g, ' ').trim();
    const back = (card.meaning || '').replace(/[\t\n\r]/g, ' ').trim();
    const reading = (card.reading || '').replace(/[\t\n\r]/g, ' ').trim();
    const sentence = (card.sentence || '').replace(/[\t\n\r]/g, ' ').trim();

    const tagList = Array.isArray(card.tags) ? [...card.tags] : [];
    if (deckTag && !tagList.includes(deckTag)) {
      tagList.push(deckTag);
    }
    const tags = tagList.join(' ');

    if (withProgress) {
      const state = card.state ?? 0;
      const difficulty = (card.difficulty ?? 0.0).toFixed(2);
      const stability = (card.stability ?? 0.0).toFixed(2);
      const reps = card.reps ?? 0;
      const lapses = card.lapses ?? 0;
      const dueDate = card.next_review_date || new Date().toISOString();

      lines.push(
        [
          front,
          back,
          reading,
          sentence,
          state.toString(),
          difficulty,
          stability,
          reps.toString(),
          lapses.toString(),
          dueDate,
          tags,
        ].join('\t')
      );
    } else {
      lines.push([front, back, reading, sentence, tags].join('\t'));
    }
  }

  return lines.join('\n');
}

/**
 * Trigger download of TSV file in the browser
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/tab-separated-values;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
