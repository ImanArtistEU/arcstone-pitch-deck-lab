import { ProvenanceSource } from './deck';

/**
 * Material claim taxonomy covering core pitch deck assertions.
 */
export type ClaimType =
  | 'problem'
  | 'solution'
  | 'product'
  | 'customer'
  | 'traction'
  | 'revenue'
  | 'growth'
  | 'unit_economics'
  | 'market'
  | 'competition'
  | 'differentiation'
  | 'technology'
  | 'team'
  | 'go_to_market'
  | 'partnership'
  | 'regulatory'
  | 'fundraising'
  | 'use_of_funds'
  | 'milestone'
  | 'other';

/**
 * Relative importance of the claim to the fundraising narrative.
 */
export type ClaimImportance = 'core' | 'supporting' | 'minor';

/**
 * Factual support status of the claim based strictly on deck evidence.
 */
export type ClaimSupportStatus =
  | 'supported'
  | 'partially_supported'
  | 'unsupported'
  | 'conflicting';

/**
 * Nature of the supporting evidence item.
 */
export type EvidenceType =
  | 'metric'
  | 'customer'
  | 'chart'
  | 'table'
  | 'citation'
  | 'source_reference'
  | 'testimonial'
  | 'product_screenshot'
  | 'contract_or_pipeline'
  | 'team_background'
  | 'market_data'
  | 'descriptive_statement'
  | 'other';

/**
 * Supporting evidence linked to a claim.
 */
export interface ClaimEvidenceItem {
  id: string;
  slideNumber: number;
  exactText: string;
  source: ProvenanceSource;
  evidenceType: EvidenceType;
  relationship: string; // Explains how this evidence supports, partially supports, or relates to the claim
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Material contradiction or conflicting data points across slides.
 */
export interface ClaimConflict {
  description: string;
  competingValues: Array<{
    value: string;
    slideNumber: number;
    source: ProvenanceSource;
  }>;
}

/**
 * Canonical Material Claim representation.
 */
export interface MaterialClaim {
  id: string;
  slideNumber: number;
  claimType: ClaimType;
  claimText: string; // Verbatim raw wording from deck
  normalizedClaim?: string;
  quantitative: boolean;
  importance: ClaimImportance;
  supportStatus: ClaimSupportStatus;
  basis: 'explicit' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
  evidence: ClaimEvidenceItem[];
  conflict?: ClaimConflict;
  notes?: string;
}

/**
 * Factual summary of the claim and evidence map.
 */
export interface ClaimMapSummary {
  totalClaims: number;
  supportedCount: number;
  partiallySupportedCount: number;
  unsupportedCount: number;
  conflictingCount: number;
  coreCount: number;
}

/**
 * Complete Claim & Evidence Map object.
 */
export interface ClaimEvidenceMap {
  claims: MaterialClaim[];
  summary: ClaimMapSummary;
  extractedAt: Date;
}

/**
 * UI State for claim map extraction.
 */
export type ClaimExtractionStatus = 'idle' | 'extracting' | 'success' | 'error';

export interface ClaimMapState {
  status: ClaimExtractionStatus;
  map: ClaimEvidenceMap | null;
  errorMessage: string | null;
}

