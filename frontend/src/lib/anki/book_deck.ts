/**
 * Book-based Anki Deck Generator
 *
 * Extracts all unique vocabulary words from an EPUB (LocalBook),
 * attaches authentic sample sentences from the book, retrieves dictionary definitions,
 * and exports a ready-to-import Anki TSV deck.
 */

import type { LocalBook, LocalToken } from '../../types/book';
import { lookupJapanese, batchLookupJapanese } from '../dictionary/japanese';
import { ExportCardItem, formatCardsToAnkiTsv, downloadFile } from './exporter';

export interface BookDeckOptions {
  book: LocalBook;
  unmasteredOnly?: boolean;
  masteredWordsSet?: Set<string>;
  maxCards?: number;
  includeDefinitions?: boolean;
  onProgress?: (current: number, total: number, status: string) => void;
}

export interface ExtractedBookWord {
  word: string;
  reading: string;
  sentence: string;
  frequency: number;
}

/**
 * Extract all unique words and representative sentences from a LocalBook.
 */
export function extractVocabularyFromBook(
  book: LocalBook,
  options: { unmasteredOnly?: boolean; masteredWordsSet?: Set<string> } = {}
): ExtractedBookWord[] {
  const wordMap = new Map<
    string,
    { reading: string; sentence: string; count: number }
  >();

  for (const chapter of book.chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph.sentences) {
        for (const token of sentence.tokens) {
          if (token.isWordLike === false) continue;

          const lemma = (token.lemma?.trim() || token.surface?.trim() || '').replace(/[\t\n\r]/g, '');
          if (!lemma || lemma.length === 0) continue;

          // Skip purely punctuation / numbers / single hiragana particles if desired
          if (/^[\d\s.,!?。、！？ー]+$/.test(lemma)) continue;

          // If unmasteredOnly, skip if already mastered
          if (options.unmasteredOnly && options.masteredWordsSet?.has(lemma)) {
            continue;
          }

          const existing = wordMap.get(lemma);
          if (existing) {
            existing.count += 1;
            // Prefer shorter, clear sentences (under 60 chars)
            if (sentence.text.length < existing.sentence.length && sentence.text.length >= 8) {
              existing.sentence = sentence.text.trim();
            }
          } else {
            wordMap.set(lemma, {
              reading: (token.reading || '').trim(),
              sentence: sentence.text.trim(),
              count: 1,
            });
          }
        }
      }
    }
  }

  // Sort by frequency descending
  const sorted: ExtractedBookWord[] = Array.from(wordMap.entries())
    .map(([word, data]) => ({
      word,
      reading: data.reading,
      sentence: data.sentence,
      frequency: data.count,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  return sorted;
}

/**
 * Generate and download an Anki deck from an EPUB.
 */
export async function exportBookToAnkiDeck(
  options: BookDeckOptions
): Promise<{ totalCards: number; filename: string }> {
  const {
    book,
    unmasteredOnly,
    masteredWordsSet,
    maxCards = 1000,
    includeDefinitions = true,
    onProgress,
  } = options;

  onProgress?.(0, 100, 'Extracting vocabulary and authentic sentences…');

  const words = extractVocabularyFromBook(book, {
    unmasteredOnly,
    masteredWordsSet,
  });

  const selectedWords = words.slice(0, maxCards);
  const total = selectedWords.length;

  if (total === 0) {
    throw new Error('No words found matching the export criteria.');
  }

  const cardItems: ExportCardItem[] = [];

  if (!includeDefinitions) {
    // Fast path: instant authentic sentence deck without dictionary lookups
    onProgress?.(50, 100, `Building ${total} authentic sentence cards…`);
    for (const item of selectedWords) {
      cardItems.push({
        word: item.word,
        reading: item.reading || undefined,
        meaning: undefined,
        sentence: item.sentence,
        tags: [`Book:${book.summary.title.replace(/\s+/g, '_')}`],
      });
    }
  } else {
    // Fast batch dictionary lookup with persistent caching
    onProgress?.(10, 100, `Looking up definitions for ${total} words…`);

    const wordList = selectedWords.map((w) => w.word);
    const batchSize = 100;
    const dictMap = new Map<string, any>();

    for (let i = 0; i < wordList.length; i += batchSize) {
      const chunk = wordList.slice(i, i + batchSize);
      const chunkResults = await batchLookupJapanese(chunk);
      for (const [w, entries] of chunkResults.entries()) {
        dictMap.set(w, entries);
      }
      const progressPct = 10 + Math.round(((i + chunk.length) / total) * 85);
      onProgress?.(
        progressPct,
        100,
        `Retrieved definitions: ${Math.min(i + chunk.length, total)} of ${total}…`
      );
    }

    for (const item of selectedWords) {
      let meaning = '';
      let reading = item.reading;

      const dictEntries = dictMap.get(item.word);
      if (dictEntries && dictEntries.length > 0) {
        const entry = dictEntries[0];
        if (!reading && entry.reading) {
          reading = entry.reading;
        }
        meaning = (entry.senses || [])
          .map((s: any) => (s.englishDefinitions || []).join(', '))
          .filter(Boolean)
          .slice(0, 3)
          .join('; ');
      }

      cardItems.push({
        word: item.word,
        reading: reading || undefined,
        meaning: meaning || undefined,
        sentence: item.sentence,
        tags: [`Book:${book.summary.title.replace(/\s+/g, '_')}`],
      });
    }
  }

  onProgress?.(98, 100, 'Generating Anki TSV file…');

  const tsvContent = formatCardsToAnkiTsv(cardItems, {
    withProgress: false,
    deckName: book.summary.title,
  });

  const safeTitle = book.summary.title.replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u4e00-\u9faf]/g, '_');
  const filename = `${safeTitle}_anki_deck.tsv`;

  downloadFile(filename, tsvContent);

  onProgress?.(100, 100, 'Download ready!');

  return {
    totalCards: cardItems.length,
    filename,
  };
}
