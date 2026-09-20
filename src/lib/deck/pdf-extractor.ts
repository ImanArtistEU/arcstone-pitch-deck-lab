import { loadPdfDocument } from './pdf-inspector';
import {
  SlideData,
  DeckExtractionResult,
  DeckExtractionSummary,
} from '@/types/deck';

/**
 * Normalizes text extracted from a PDF page text content items array.
 * Preserves actual wording, numbers, currency, percentages, and punctuation,
 * while collapsing redundant whitespace and building natural line breaks.
 * Handles both TextItem objects and TextMarkedContent objects safely.
 */
function normalizePageTextItems(items: Array<{ str?: string; transform?: number[] }>): string {
  if (!items || !Array.isArray(items) || items.length === 0) return '';

  const lines: string[] = [];
  let currentLine = '';
  let lastY: number | null = null;

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const str = item.str;

    // item.transform[5] is the Y-coordinate on the page
    const y = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform[5] : null;

    // Detect new line if Y coordinate shifts significantly (e.g. > 6 points)
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
      const trimmedLine = currentLine.replace(/[ \t]+/g, ' ').trim();
      if (trimmedLine) {
        lines.push(trimmedLine);
      }
      currentLine = str;
    } else {
      if (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ')) {
        currentLine += ' ' + str;
      } else {
        currentLine += str;
      }
    }

    if (y !== null) lastY = y;
  }

  const finalTrimmed = currentLine.replace(/[ \t]+/g, ' ').trim();
  if (finalTrimmed) {
    lines.push(finalTrimmed);
  }

  return lines.join('\n').trim();
}

/**
 * Computes exact word count of extracted text.
 */
function computeWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts slide-by-slide text content from a local PDF pitch deck File.
 * 
 * @param file Local PDF pitch deck File
 * @returns Promise<DeckExtractionResult>
 */
export async function extractSlidesFromPdf(file: File): Promise<DeckExtractionResult> {
  try {
    const pdfDoc = await loadPdfDocument(file);
    const totalPages = pdfDoc.numPages;
    const slides: SlideData[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        
        // Stage A: Retrieve text content from PDF.js page object
        let textContent;
        try {
          textContent = await page.getTextContent();
        } catch (stageAError) {
          console.error(`[Arcstone PDF Extraction] Page ${pageNum} failed at Stage A (page.getTextContent()):`, {
            pageNumber: pageNum,
            errorName: stageAError instanceof Error ? stageAError.name : 'UnknownError',
            errorMessage: stageAError instanceof Error ? stageAError.message : String(stageAError),
            errorStack: stageAError instanceof Error ? stageAError.stack : undefined,
          });
          throw stageAError;
        }

        // Stage B: Process and normalize returned text-content array
        let extractedText = '';
        try {
          const rawItems = (textContent?.items as Array<{ str?: string; transform?: number[] }>) || [];
          extractedText = normalizePageTextItems(rawItems);
        } catch (stageBError) {
          console.error(`[Arcstone PDF Extraction] Page ${pageNum} failed at Stage B (normalizePageTextItems):`, {
            pageNumber: pageNum,
            errorName: stageBError instanceof Error ? stageBError.name : 'UnknownError',
            errorMessage: stageBError instanceof Error ? stageBError.message : String(stageBError),
            errorStack: stageBError instanceof Error ? stageBError.stack : undefined,
          });
          throw stageBError;
        }

        const wordCount = computeWordCount(extractedText);
        const characterCount = extractedText.length;

        if (characterCount > 0) {
          slides.push({
            pageNumber: pageNum,
            text: extractedText,
            characterCount,
            wordCount,
            status: 'extracted',
          });
        } else {
          slides.push({
            pageNumber: pageNum,
            text: '',
            characterCount: 0,
            wordCount: 0,
            status: 'empty',
          });
        }
      } catch (pageError) {
        // Detailed error log for developers in console
        console.error(`[Arcstone PDF Extraction] Page ${pageNum} extraction failed:`, {
          pageNumber: pageNum,
          errorName: pageError instanceof Error ? pageError.name : 'UnknownError',
          errorMessage: pageError instanceof Error ? pageError.message : String(pageError),
          errorStack: pageError instanceof Error ? pageError.stack : undefined,
        });

        slides.push({
          pageNumber: pageNum,
          text: '',
          characterCount: 0,
          wordCount: 0,
          status: 'error',
          errorMessage: 'Unable to extract text from this page.',
        });
      }
    }

    const summary: DeckExtractionSummary = {
      totalPages,
      extractedCount: slides.filter((s) => s.status === 'extracted').length,
      emptyCount: slides.filter((s) => s.status === 'empty').length,
      errorCount: slides.filter((s) => s.status === 'error').length,
    };

    return {
      slides,
      summary,
      extractedAt: new Date(),
    };
  } catch (error) {
    console.error('[pdf-extractor] PDF slide extraction error:', error);
    throw new Error("We couldn't read this PDF. The file may be corrupted or use an unsupported PDF format.");
  }
}
