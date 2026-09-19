import JSZip from 'jszip';

import type {
  BookLanguage,
  LocalChapter,
  LocalParagraph,
  LocalSentence,
} from '../../../types/book';

import { tokenizerClient } from '../tokenizer';

export type EpubProgressCallback = (message: string) => void;

function stripQueryAndFragment(value: string): string {
  return value.split('#', 1)[0].split('?', 1)[0];
}

/**
 * Resolve an EPUB href relative to the file that contains the href.
 * EPUB ZIP paths always use '/' regardless of the host OS.
 */
function resolveEpubPath(baseFilePath: string, relativePath: string): string {
  let href = stripQueryAndFragment(relativePath).replace(/\\/g, '/');

  try {
    href = decodeURIComponent(href);
  } catch {
    // Keep the raw href if it is not valid percent-encoding.
  }

  const baseDir = baseFilePath.includes('/')
    ? baseFilePath.slice(0, baseFilePath.lastIndexOf('/') + 1)
    : '';

  const combined = href.startsWith('/')
    ? href.slice(1)
    : `${baseDir}${href}`;

  const normalized: string[] = [];

  for (const part of combined.split('/')) {
    if (!part || part === '.') continue;

    if (part === '..') {
      normalized.pop();
      continue;
    }

    normalized.push(part);
  }

  return normalized.join('/');
}

function parseXml(xml: string, label: string): Document {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');

  if (document.querySelector('parsererror')) {
    throw new Error(`Invalid EPUB XML in ${label}.`);
  }

  return document;
}

function localElements(document: Document, name: string): Element[] {
  return Array.from(document.getElementsByTagNameNS('*', name));
}

function firstLocalElement(document: Document, name: string): Element | undefined {
  return localElements(document, name)[0];
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract semantic paragraphs without returning nested duplicates.
 * EPUB XHTML varies substantially, so we prefer real <p> elements and
 * otherwise treat top-level block elements as paragraphs.
 */
function extractParagraphs(htmlText: string): string[] {
  const parser = new DOMParser();

  let document = parser.parseFromString(
    htmlText,
    'application/xhtml+xml'
  );

  if (document.querySelector('parsererror')) {
    document = parser.parseFromString(htmlText, 'text/html');
  }

  const root =
    document.querySelector('body') ??
    document.documentElement;

  if (!root) return [];

  const paragraphs = Array.from(root.querySelectorAll('p'))
    .map((element) => normalizeText(element.textContent ?? ''))
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs;

  const blocks = Array.from(
    root.querySelectorAll(
      'div, section, article, blockquote, li, h1, h2, h3, h4, h5, h6'
    )
  )
    .filter((element) => {
      const parent = element.parentElement;
      if (!parent) return true;

      return !parent.querySelector(':scope > p') &&
        !element.querySelector('div, section, article, blockquote, li');
    })
    .map((element) => normalizeText(element.textContent ?? ''))
    .filter(Boolean);

  if (blocks.length > 0) return blocks;

  const bodyText = normalizeText(root.textContent ?? '');
  return bodyText ? [bodyText] : [];
}

export function splitIntoSentences(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const sentences: string[] = [];
  let current = '';

  const isTerminator = (char: string) =>
    char === '。' ||
    char === '！' ||
    char === '？' ||
    char === '!' ||
    char === '?' ||
    char === '.';

  const isClosing = (char: string) =>
    '」』）)】》〉”’'.includes(char);

  const chars = Array.from(normalized);

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === '\n') {
      const value = current.trim();
      if (value) sentences.push(value);
      current = '';
      continue;
    }

    current += char;

    if (isTerminator(char)) {
      while (i + 1 < chars.length && isClosing(chars[i + 1])) {
        current += chars[++i];
      }

      const value = current.trim();
      if (value) sentences.push(value);
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) sentences.push(tail);

  return sentences;
}

export async function parseEpubFile(
  bookId: string,
  file: File,
  language: BookLanguage,
  onProgress?: EpubProgressCallback
): Promise<LocalChapter[]> {
  const reportProgress =
    typeof onProgress === 'function' ? onProgress : () => {};

  if (!file.name.toLowerCase().endsWith('.epub')) {
    throw new Error('Please select a valid .epub file.');
  }

  if (file.size === 0) {
    throw new Error('The EPUB file is empty.');
  }

  reportProgress('Unpacking EPUB structure…');

  const zip = await JSZip.loadAsync(file);
  const containerFile = zip.file('META-INF/container.xml');

  if (!containerFile) {
    throw new Error(
      'Invalid EPUB: META-INF/container.xml was not found.'
    );
  }

  reportProgress('Locating EPUB package metadata…');

  const containerText = await containerFile.async('text');
  const containerDoc = parseXml(containerText, 'META-INF/container.xml');
  const rootfile = firstLocalElement(containerDoc, 'rootfile');
  const opfRelativePath = rootfile?.getAttribute('full-path');

  if (!opfRelativePath) {
    throw new Error(
      'Invalid EPUB: the package OPF path was not found.'
    );
  }

  const opfPath = resolveEpubPath('', opfRelativePath);
  const opfFile = zip.file(opfPath);

  if (!opfFile) {
    throw new Error(`Invalid EPUB: OPF file not found at "${opfPath}".`);
  }

  reportProgress('Reading EPUB manifest…');

  const opfText = await opfFile.async('text');
  const opfDoc = parseXml(opfText, opfPath);

  type ManifestItem = {
    href: string;
    mediaType?: string;
  };

  const manifest = new Map<string, ManifestItem>();

  for (const item of localElements(opfDoc, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');

    if (!id || !href) continue;

    manifest.set(id, {
      href,
      mediaType: item.getAttribute('media-type') ?? undefined,
    });
  }

  if (manifest.size === 0) {
    throw new Error('Invalid EPUB: no manifest items were found.');
  }

  const spine = firstLocalElement(opfDoc, 'spine');
  const spineNodes = spine
    ? localElements(spine.ownerDocument!, 'itemref').filter(
        (element) => element.parentElement === spine
      )
    : [];

  if (spineNodes.length === 0) {
    throw new Error('Invalid EPUB: no spine reading order was found.');
  }

  const chapters: LocalChapter[] = [];

  for (let spineIndex = 0; spineIndex < spineNodes.length; spineIndex++) {
    const itemRef = spineNodes[spineIndex];

    if (itemRef.getAttribute('linear')?.toLowerCase() === 'no') {
      continue;
    }

    const idref = itemRef.getAttribute('idref');
    if (!idref) continue;

    const manifestItem = manifest.get(idref);
    if (!manifestItem) {
      console.warn(`EPUB: spine references missing manifest item "${idref}".`);
      continue;
    }

    const mediaType = manifestItem.mediaType?.toLowerCase();

    if (
      mediaType &&
      ![
        'application/xhtml+xml',
        'text/html',
        'application/x-dtbook+xml',
      ].includes(mediaType)
    ) {
      continue;
    }

    const contentPath = resolveEpubPath(opfPath, manifestItem.href);
    const contentFile = zip.file(contentPath);

    if (!contentFile) {
      console.warn(
        `EPUB: could not find spine document "${contentPath}" for "${idref}".`
      );
      continue;
    }

    const htmlText = await contentFile.async('text');
    const paragraphs = extractParagraphs(htmlText);

    if (paragraphs.length === 0) continue;

    reportProgress(
      `Processing chapter ${chapters.length + 1}…`
    );

    const chapterDoc = parserForHtml(htmlText);
    const titleElement = chapterDoc.querySelector('h1, h2, h3, title');
    const extractedTitle = normalizeText(titleElement?.textContent ?? '');

    const chapterId = `${bookId}-ch-${chapters.length + 1}`;
    const localParagraphs: LocalParagraph[] = [];

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const sentenceTexts = splitIntoSentences(paragraphs[paragraphIndex]);
      const localSentences: LocalSentence[] = [];

      for (let sentenceIndex = 0; sentenceIndex < sentenceTexts.length; sentenceIndex++) {
        const sentenceText = sentenceTexts[sentenceIndex];
        const sentenceId =
          `${chapterId}-p-${paragraphIndex + 1}-s-${sentenceIndex + 1}`;

        const tokens = await tokenizerClient.tokenize(sentenceText, language);

        const stableTokens = tokens.map((token, tokenIndex) => ({
          ...token,
          id: `${sentenceId}-token-${tokenIndex}`,
        }));

        localSentences.push({
          id: sentenceId,
          text: sentenceText,
          tokens: stableTokens,
        });
      }

      if (localSentences.length > 0) {
        localParagraphs.push({
          id: `${chapterId}-p-${paragraphIndex + 1}`,
          sentences: localSentences,
        });
      }
    }

    if (localParagraphs.length > 0) {
      chapters.push({
        id: chapterId,
        bookId,
        index: chapters.length,
        title: extractedTitle || `Chapter ${chapters.length + 1}`,
        paragraphs: localParagraphs,
      });
    }
  }

  if (chapters.length === 0) {
    throw new Error(
      'No readable chapters were found in this EPUB. The book may use an unsupported or encrypted format.'
    );
  }

  reportProgress(`Finished parsing ${chapters.length} chapters.`);
  return chapters;
}

function parserForHtml(htmlText: string): Document {
  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(
    htmlText,
    'application/xhtml+xml'
  );

  return xmlDocument.querySelector('parsererror')
    ? parser.parseFromString(htmlText, 'text/html')
    : xmlDocument;
}
