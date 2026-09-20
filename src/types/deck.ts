/**
 * Maximum allowed pitch deck PDF size in megabytes and bytes.
 */
export const MAX_FILE_SIZE_MB = 25;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Represents a local pitch deck file selected by the user.
 */
export interface LocalDeckFile {
  file: File;
  name: string;
  sizeFormatted: string;
  sizeBytes: number;
  uploadedAt: Date;
}

/**
 * Upload validation error states.
 */
export type UploadErrorType = 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UNKNOWN';

export interface UploadError {
  type: UploadErrorType;
  message: string;
}

/**
 * Structured PDF document metadata extracted directly from PDF metadata dictionary.
 */
export interface PdfDocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

/**
 * Inspection result from local PDF parsing.
 */
export interface PdfInspectionResult {
  pageCount: number;
  metadata: PdfDocumentMetadata;
  inspectedAt: Date;
}

/**
 * Provenance tracking source for extracted evidence items.
 */
export type ProvenanceSource = 'native_pdf' | 'visual_model' | 'both';

/**
 * Individual financial, growth, or operational metric detected on a slide.
 */
export interface VisualMetric {
  label: string;
  value: string;
  context?: string;
  category?: 'financial' | 'growth' | 'market' | 'users' | 'fundraising' | 'pricing' | 'other';
}

/**
 * Table content extracted visually from a slide.
 */
export interface VisualTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

/**
 * Chart or data visualization content extracted from a slide.
 */
export interface VisualChart {
  chartType: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'other';
  title?: string;
  axes?: string;
  series?: string[];
  displayedValues?: string[];
  trend?: string;
}

/**
 * Diagram or flowchart extracted from a slide.
 */
export interface VisualDiagram {
  title?: string;
  nodes: string[];
  relationships: string[];
  labels: string[];
}

/**
 * Complete structured visual understanding output from Gemini multimodal analysis.
 */
export interface VisualExtraction {
  title?: string;
  subtitle?: string;
  summary?: string;
  visibleText?: string;
  metrics: VisualMetric[];
  tables: VisualTable[];
  charts: VisualChart[];
  diagrams: VisualDiagram[];
  productScreenshots?: string[];
  logos?: string[];
  importantVisualElements?: string[];
}

/**
 * Normalized evidence item with explicit provenance and page tracking.
 */
export interface EvidenceItem {
  id: string;
  pageNumber: number;
  source: ProvenanceSource;
  category: 'metric' | 'claim' | 'heading' | 'table' | 'chart' | 'general';
  label: string;
  value: string;
  confidence?: 'high' | 'medium' | 'low';
  conflictWarning?: string;
}

/**
 * Combined evidence resulting from native + visual fusion.
 */
export interface CombinedEvidence {
  normalizedText: string;
  keyFacts: string[];
  evidenceItems: EvidenceItem[];
}

/**
 * Processing status for individual pipeline stages.
 */
export type ProcessingStatus = 'success' | 'empty' | 'skipped' | 'error';

/**
 * Pipeline processing state for a single slide.
 */
export interface SlideProcessingInfo {
  nativeStatus: ProcessingStatus;
  visualStatus: ProcessingStatus;
  warnings: string[];
  nativeError?: string;
  visualError?: string;
}

/**
 * Native PDF.js text extraction output with spatial text block metadata.
 */
export interface NativeExtractionData {
  rawText: string;
  textBlocks: Array<{ text: string; transform?: number[] }>;
  characterCount: number;
  wordCount: number;
  status: ProcessingStatus;
  errorMessage?: string;
}

/**
 * Complete canonical slide representation combining native PDF + visual Gemini analysis.
 */
export interface HybridSlideData {
  pageNumber: number; // 1-indexed
  slideImageUri?: string; // High-DPI JPEG Data URL
  nativeExtraction: NativeExtractionData;
  visualExtraction?: VisualExtraction;
  combinedEvidence: CombinedEvidence;
  processing: SlideProcessingInfo;
}

/**
 * Deck-level extraction summary.
 */
export interface HybridDeckSummary {
  totalPages: number;
  nativeSuccessCount: number;
  visualSuccessCount: number;
  emptyCount: number;
  warningCount: number;
  errorCount: number;
  geminiActive: boolean;
}

/**
 * Canonical deck extraction result across all slides.
 */
export interface HybridDeckResult {
  metadata: PdfDocumentMetadata;
  slides: HybridSlideData[];
  summary: HybridDeckSummary;
  extractedAt: Date;
}

/**
 * Deck processing state management for UI.
 */
export type DeckProcessingStatus = 'idle' | 'reading' | 'rendering' | 'analyzing' | 'success' | 'error';

export interface DeckProcessingState {
  status: DeckProcessingStatus;
  progressPercent: number;
  currentStage: string;
  inspectionResult: PdfInspectionResult | null;
  hybridResult: HybridDeckResult | null;
  errorMessage: string | null;
}

/* ==========================================================================
   LEGACY ADAPTER ALIASES (For backward compatibility with early extraction code)
   ========================================================================== */

export type SlideExtractionStatus = 'extracted' | 'empty' | 'error';

export interface SlideData {
  pageNumber: number;
  text: string;
  characterCount: number;
  wordCount: number;
  status: SlideExtractionStatus;
  errorMessage?: string;
}

export interface DeckExtractionSummary {
  totalPages: number;
  extractedCount: number;
  emptyCount: number;
  errorCount: number;
}

export interface DeckExtractionResult {
  slides: SlideData[];
  summary: DeckExtractionSummary;
  extractedAt: Date;
}
