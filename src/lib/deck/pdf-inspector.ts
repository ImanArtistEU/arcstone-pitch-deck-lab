import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfInspectionResult, PdfDocumentMetadata } from '@/types/deck';

// Resolve local Arcstone static asset paths for both Browser and Node/SSR environments
const isBrowser = typeof window !== 'undefined';

const CMAP_URL = isBrowser
  ? '/pdfjs/cmaps/'
  : 'file://' + process.cwd() + '/public/pdfjs/cmaps/';

const STANDARD_FONT_DATA_URL = isBrowser
  ? '/pdfjs/standard_fonts/'
  : 'file://' + process.cwd() + '/public/pdfjs/standard_fonts/';

// Configure worker for browser environment using locally bundled asset
if (isBrowser && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
}

/**
 * Format raw PDF date string (e.g. "D:20231012153000Z") into clean YYYY-MM-DD format.
 */
function formatPdfDate(rawDate: unknown): string | undefined {
  if (!rawDate) return undefined;
  if (typeof rawDate === 'string') {
    if (rawDate.startsWith('D:')) {
      const cleanStr = rawDate.substring(2);
      const year = cleanStr.substring(0, 4);
      const month = cleanStr.substring(4, 6);
      const day = cleanStr.substring(6, 8);
      if (year && month && day && !isNaN(Number(year))) {
        return `${year}-${month}-${day}`;
      }
    }
    const trimmed = rawDate.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return rawDate.toISOString().split('T')[0];
  }
  return undefined;
}

/**
 * Loads a PDF document from a File into a pdfjs PDFDocumentProxy.
 * Configured with local Arcstone-hosted CMap, Standard Font, and Worker resources.
 */
export async function loadPdfDocument(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  return await loadingTask.promise;
}

/**
 * Inspects a local PDF pitch deck File to determine page count and extract document metadata.
 * 
 * @param file Local PDF File selected by user.
 * @returns Promise<PdfInspectionResult>
 */
export async function inspectPdf(file: File): Promise<PdfInspectionResult> {
  try {
    const pdfDoc = await loadPdfDocument(file);
    const pageCount = pdfDoc.numPages;

    const rawMetadata = await pdfDoc.getMetadata();
    const info = (rawMetadata?.info as Record<string, unknown>) || {};

    const cleanString = (val: unknown): string | undefined => {
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
      return undefined;
    };

    const metadata: PdfDocumentMetadata = {
      title: cleanString(info.Title),
      author: cleanString(info.Author),
      subject: cleanString(info.Subject),
      creator: cleanString(info.Creator),
      producer: cleanString(info.Producer),
      creationDate: formatPdfDate(info.CreationDate),
      modificationDate: formatPdfDate(info.ModDate),
    };

    return {
      pageCount,
      metadata,
      inspectedAt: new Date(),
    };
  } catch (error) {
    console.error('[pdf-inspector] PDF parsing error:', error);
    throw new Error("We couldn't read this PDF. The file may be corrupted or use an unsupported PDF format.");
  }
}
