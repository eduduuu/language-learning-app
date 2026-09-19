export type BookLanguage = 'japanese' | 'english';

export type BookStatus = 'learning' | 'on_hold' | 'completed';

export interface LocalToken {
  id: string;

  surface: string;

  lemma: string;

  dictionaryForm: string;

  reading?: string;

  partOfSpeech?: string;

  isWordLike: boolean;
}
export interface LocalSentence {
  id: string;
  text: string;
  tokens: LocalToken[];
}

export interface LocalParagraph {
  id: string;
  sentences: LocalSentence[];
}

export interface LocalChapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  paragraphs: LocalParagraph[];
}

export interface BookSummary {
  id: string;
  title: string;
  language: BookLanguage;
  status: BookStatus;
  coverUrl?: string;
  fingerprint: string;
  mastery: number;
  knownWords: number;
  totalWords: number;
  createdAt: string;
  lastOpenedAt: string;
  currentChapterId?: string;
  currentSentenceId?: string;
  backendId?: string;
}

export interface LocalBookFile {
  bookId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
}

export interface LocalBook {
  summary: BookSummary;
  chapters: LocalChapter[];
  file?: LocalBookFile;
}
