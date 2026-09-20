import { ProvenanceSource } from './deck';

/**
 * Priority groups for founder-facing recommendations
 */
export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'POLISH';

/**
 * Practical, actionable taxonomy for recommended changes
 */
export type RecommendationActionType =
  | 'CLARIFY_EXISTING_INFORMATION'
  | 'ADD_EXISTING_EVIDENCE'
  | 'REQUEST_FOUNDER_INFORMATION'
  | 'RESOLVE_CONTRADICTION'
  | 'RESTRUCTURE_NARRATIVE'
  | 'STRENGTHEN_EVIDENCE'
  | 'REMOVE_OR_QUALIFY_CLAIM'
  | 'IMPROVE_SLIDE_STRUCTURE'
  | 'CONNECT_LOGIC';

/**
 * Structural outline suggested for a slide
 */
export interface SuggestedSlideStructure {
  targetSlideNumber?: number;
  slideTitle?: string;
  headline?: string;
  supportingMetrics?: string[];
  supportingContext?: string[];
  evidenceSlideReferences?: number[];
  placeholders?: string[]; // e.g. "[Founder input required: growth measurement period]"
}

/**
 * Grounded Before / After copy comparison block
 */
export interface SuggestedCopyBlock {
  currentText: string;
  suggestedText: string;
  explanation: string;
}

/**
 * Evidence item already found in the deck supporting the recommendation
 */
export interface RecommendationEvidenceItem {
  slideNumber: number;
  statement: string;
  source: ProvenanceSource;
}

/**
 * Problem taxonomy V2 for investor underwriting gaps
 */
export type ProblemClass =
  | 'FACTUAL_GAP'
  | 'EVIDENCE_GAP'
  | 'COMMUNICATION_GAP'
  | 'LOGIC_GAP'
  | 'INVESTMENT_CASE_RISK';

/**
 * Canonical Founder Recommendation Model
 */
export interface FounderRecommendation {
  id: string;
  priority: RecommendationPriority;
  category: string; // e.g. 'traction', 'business_model', 'market', 'gtm', 'competition', 'narrative', 'ask'
  title: string;
  problem: string;
  problemClass?: ProblemClass;
  whyItMatters: string;
  investorInterpretation?: string;
  whyNow?: string;
  resolutionCriteria?: string[];
  actionType: RecommendationActionType;
  targetSlides: number[];
  isNewSlideOrSection?: boolean;

  // Upstream Analytical Links
  relatedClaims: string[];
  relatedDiagnostics: string[];
  relatedEvaluationDimensions: string[];
  relatedInvestorQuestions: string[];

  // Factual grounding & inputs
  existingEvidence: RecommendationEvidenceItem[];
  missingInformation: string[];
  founderInputRequired: boolean;
  isQuickWin: boolean; // true if !founderInputRequired and improves structure/clarity immediately

  // Prescribed fix
  recommendedAction: string;
  suggestedStructure?: SuggestedSlideStructure;
  suggestedCopy?: SuggestedCopyBlock;
  expectedImpact: string;

  // Execution order & dependency graph
  blockedByRecommendationIds: string[];
  executionOrder: number; // 1-indexed chronological sequence

  confidence: 'high' | 'medium' | 'low';
}

/**
 * Consolidated checklist item for information the founder must supply
 */
export interface FounderInputItem {
  id: string;
  recommendationId: string;
  recommendationTitle: string;
  category: string;
  prompt: string;
  targetSlides: number[];
}

/**
 * High-level Action Plan Summary
 */
export interface ActionPlanSummary {
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  polishCount: number;
  quickWinsCount: number;
  founderInputsRequiredCount: number;
}

/**
 * Complete canonical result from Development Batch 4C
 */
export interface ActionPlanResult {
  recommendations: FounderRecommendation[];
  founderChecklist: FounderInputItem[];
  quickWins: FounderRecommendation[];
  summary: ActionPlanSummary;
  generatedAt: Date;
}

/**
 * UI State for Founder Recommendations
 */
export type RecommendationsStatus = 'idle' | 'generating' | 'success' | 'error';

export interface RecommendationsState {
  status: RecommendationsStatus;
  result: ActionPlanResult | null;
  errorMessage: string | null;
}

