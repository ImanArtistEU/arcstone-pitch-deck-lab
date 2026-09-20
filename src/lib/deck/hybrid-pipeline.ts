import { loadPdfDocument, inspectPdf } from './pdf-inspector';
import { renderSlideToImage } from './pdf-renderer';
import { fuseSlideEvidence } from './evidence-fusion';
import {
  HybridDeckResult,
  HybridSlideData,
  HybridDeckSummary,
  NativeExtractionData,
  VisualExtraction,
  SlideProcessingInfo,
} from '@/types/deck';

/**
 * Progress status update payload.
 */
export interface PipelineProgressUpdate {
  stage: string;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
}

/**
 * Normalizes text extracted from PDF.js text items array with position transforms.
 */
function normalizePageTextItems(items: Array<{ str?: string; transform?: number[] }>): {
  rawText: string;
  blocks: Array<{ text: string; transform?: number[] }>;
} {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { rawText: '', blocks: [] };
  }

  const lines: string[] = [];
  const blocks: Array<{ text: string; transform?: number[] }> = [];
  let currentLine = '';
  let lastY: number | null = null;

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const str = item.str;
    const y = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform[5] : null;

    if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
      const trimmedLine = currentLine.replace(/[ \t]+/g, ' ').trim();
      if (trimmedLine) {
        lines.push(trimmedLine);
        blocks.push({ text: trimmedLine, transform: item.transform });
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
    blocks.push({ text: finalTrimmed });
  }

  return {
    rawText: lines.join('\n').trim(),
    blocks,
  };
}

/**
 * Calls server-side Gemini 2.5 Flash multimodal API for a single rendered slide image.
 */
async function analyzeSlideWithGemini(
  pageNumber: number,
  imageBase64: string,
  nativeText: string
): Promise<{ status: 'success' | 'skipped' | 'error'; visualExtraction?: VisualExtraction; error?: string }> {
  try {
    const response = await fetch('/api/deck/analyze-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageNumber,
        imageBase64,
        nativeText,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return {
        status: 'error',
        error: errJson.message || `API error (${response.status})`,
      };
    }

    const result = await response.json();

    if (result.status === 'skipped') {
      return { status: 'skipped', error: result.message };
    }

    if (result.status === 'success' && result.data) {
      return { status: 'success', visualExtraction: result.data };
    }

    return { status: 'error', error: result.message || 'Unknown visual extraction error' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: msg };
  }
}

/**
 * Executes the complete Hybrid Pitch Deck Ingestion Pipeline.
 * 
 * Flow:
 * PDF -> Inspector -> Page Render + Native Text -> Server Gemini Multimodal Analysis -> Evidence Fusion
 * 
 * @param file Pitch deck PDF File selected by user
 * @param onProgress Callback for pipeline progress updates
 * @returns Promise<HybridDeckResult>
 */
export async function executeHybridIngestionPipeline(
  file: File,
  onProgress?: (update: PipelineProgressUpdate) => void
): Promise<HybridDeckResult> {
  // 1. Inspect Document Metadata
  if (onProgress) {
    onProgress({
      stage: 'Inspecting PDF Document',
      currentPage: 0,
      totalPages: 0,
      progressPercent: 5,
    });
  }

  const inspection = await inspectPdf(file);
  const pdfDoc = await loadPdfDocument(file);
  const totalPages = pdfDoc.numPages;

  const slides: HybridSlideData[] = [];
  let geminiActive = false;

  // Process slides with controlled batch concurrency (batch size 2)
  const BATCH_SIZE = 2;

  for (let pageNum = 1; pageNum <= totalPages; pageNum += BATCH_SIZE) {
    const pageBatch = Array.from(
      { length: Math.min(BATCH_SIZE, totalPages - pageNum + 1) },
      (_, i) => pageNum + i
    );

    const batchPromises = pageBatch.map(async (pNum) => {
      if (onProgress) {
        const percent = Math.floor(10 + (pNum / totalPages) * 85);
        onProgress({
          stage: `Processing Slide ${pNum} of ${totalPages}`,
          currentPage: pNum,
          totalPages,
          progressPercent: percent,
        });
      }

      // Stage A: Native PDF Text Extraction
      let nativeData: NativeExtractionData = {
        rawText: '',
        textBlocks: [],
        characterCount: 0,
        wordCount: 0,
        status: 'empty',
      };

      try {
        const page = await pdfDoc.getPage(pNum);
        const textContent = await page.getTextContent();
        const items = (textContent?.items as Array<{ str?: string; transform?: number[] }>) || [];
        const { rawText, blocks } = normalizePageTextItems(items);

        const charCount = rawText.length;
        const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;

        nativeData = {
          rawText,
          textBlocks: blocks,
          characterCount: charCount,
          wordCount,
          status: charCount > 0 ? 'success' : 'empty',
        };
      } catch (nativeErr) {
        const msg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
        nativeData = {
          rawText: '',
          textBlocks: [],
          characterCount: 0,
          wordCount: 0,
          status: 'error',
          errorMessage: msg,
        };
      }

      // Stage B: Slide Rendering (Canvas High-DPI Image)
      let slideImageUri: string | undefined = undefined;
      try {
        const rendered = await renderSlideToImage(pdfDoc, pNum);
        slideImageUri = rendered.dataUrl;
      } catch (renderErr) {
        console.error(`[hybrid-pipeline] Render failed for Slide ${pNum}:`, renderErr);
      }

      // Stage C: Server Multimodal Gemini Visual Analysis
      let visualExtraction: VisualExtraction | undefined = undefined;
      let visualStatus: 'success' | 'empty' | 'skipped' | 'error' = 'skipped';
      let visualError: string | undefined = undefined;

      if (slideImageUri) {
        const visualResult = await analyzeSlideWithGemini(pNum, slideImageUri, nativeData.rawText);
        if (visualResult.status === 'success' && visualResult.visualExtraction) {
          visualExtraction = visualResult.visualExtraction;
          visualStatus = 'success';
          geminiActive = true;
        } else if (visualResult.status === 'skipped') {
          visualStatus = 'skipped';
          visualError = visualResult.error;
        } else {
          visualStatus = 'error';
          visualError = visualResult.error;
        }
      }

      // Stage D: Evidence Fusion
      const warnings: string[] = [];
      if (nativeData.status === 'empty' && visualStatus === 'success') {
        warnings.push('Native text layer empty; visual AI extracted slide content.');
      } else if (nativeData.status === 'success' && visualStatus === 'error') {
        warnings.push('Visual AI analysis failed; falling back to native PDF evidence.');
      }

      const combinedEvidence = fuseSlideEvidence(pNum, nativeData.rawText, visualExtraction);

      const processingInfo: SlideProcessingInfo = {
        nativeStatus: nativeData.status,
        visualStatus,
        warnings,
        nativeError: nativeData.errorMessage,
        visualError,
      };

      const hybridSlide: HybridSlideData = {
        pageNumber: pNum,
        slideImageUri,
        nativeExtraction: nativeData,
        visualExtraction,
        combinedEvidence,
        processing: processingInfo,
      };

      return hybridSlide;
    });

    const batchResults = await Promise.all(batchPromises);
    slides.push(...batchResults);
  }

  // Sort slides by page number
  slides.sort((a, b) => a.pageNumber - b.pageNumber);

  // Summary Metrics
  const summary: HybridDeckSummary = {
    totalPages,
    nativeSuccessCount: slides.filter((s) => s.processing.nativeStatus === 'success').length,
    visualSuccessCount: slides.filter((s) => s.processing.visualStatus === 'success').length,
    emptyCount: slides.filter((s) => s.processing.nativeStatus === 'empty' && s.processing.visualStatus !== 'success').length,
    warningCount: slides.filter((s) => s.processing.warnings.length > 0).length,
    errorCount: slides.filter((s) => s.processing.nativeStatus === 'error' || s.processing.visualStatus === 'error').length,
    geminiActive,
  };

  if (onProgress) {
    onProgress({
      stage: 'Ingestion Pipeline Complete',
      currentPage: totalPages,
      totalPages,
      progressPercent: 100,
    });
  }

  return {
    metadata: inspection.metadata,
    slides,
    summary,
    extractedAt: new Date(),
  };
}

