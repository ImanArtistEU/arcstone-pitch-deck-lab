import { ProvenanceSource } from './deck';

/**
 * Diagnostic severity reflecting impact on understanding the fundraising case.
 */
export type DiagnosticSeverity = 'critical' | 'material' | 'minor';

/**
 * Diagnostic Category taxonomy.
 */
export type DiagnosticCategory =
  | 'contradiction'
  | 'evidence_gap'
  | 'missing_information'
  | 'ambiguity';

/**
 * Contradiction diagnostic across slides or structured outputs.
 */
export interface ContradictionDiagnostic {
  id: string;
  category: string; // e.g. "customer_count", "stage", "business_model", "valuation"
  severity: DiagnosticSeverity;
  description: string;
  conflictingStatements: Array<{
    text: string;
    slideNumber: number;
    source: ProvenanceSource;
  }>;
  whyConflicting: string;
  chronologyExplained: boolean; // True if dates/timeframes explain difference
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Evidence gap diagnostic where a claim lacks sufficient substantiation inside the deck.
 */
export interface EvidenceGapDiagnostic {
  id: string;
  claimId?: string;
  claimText: string;
  claimType: string;
  severity: DiagnosticSeverity;
  supportStatus: 'unsupported' | 'partially_supported';
  importance: 'core' | 'supporting' | 'minor';
  slideNumbers: number[];
  currentEvidenceSummary: string;
  missingEvidenceDescription: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Important factual profile field absent from the deck.
 */
export interface MissingInfoDiagnostic {
  id: string;
  field: string;
  category: string; // fundraising, traction, economics, market, competition, gtm, team, tech
  severity: DiagnosticSeverity;
  context: string;
  whyRelevant?: string;
  relatedClaimIds?: string[];
  relatedSlideNumbers?: number[];
}

/**
 * Statement or metric that cannot be confidently interpreted due to missing qualifiers.
 */
export interface AmbiguityDiagnostic {
  id: string;
  statement: string;
  slideNumber: number;
  severity: DiagnosticSeverity;
  whatIsUnclear: string;
  possibleInterpretations: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Summary metrics of all diagnostics.
 */
export interface DiagnosticSummary {
  totalDiagnostics: number;
  contradictionCount: number;
  evidenceGapCount: number;
  missingInfoCount: number;
  ambiguityCount: number;
  criticalCount: number;
  materialCount: number;
  minorCount: number;
}

/**
 * Complete canonical Deck Diagnostics result.
 */
export interface DeckDiagnostics {
  contradictions: ContradictionDiagnostic[];
  evidenceGaps: EvidenceGapDiagnostic[];
  missingInformation: MissingInfoDiagnostic[];
  ambiguities: AmbiguityDiagnostic[];
  summary: DiagnosticSummary;
  extractedAt: Date;
}

/**
 * UI State for Deck Diagnostics.
 */
export type DiagnosticStatus = 'idle' | 'analyzing' | 'success' | 'error';

export interface DiagnosticsState {
  status: DiagnosticStatus;
  diagnostics: DeckDiagnostics | null;
  errorMessage: string | null;
}

