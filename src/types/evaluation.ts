/**
 * Qualitative Dimension Status
 */
export type DimensionStatus =
  | 'STRONG'
  | 'ADEQUATE'
  | 'UNDERDEVELOPED'
  | 'MISSING'
  | 'CONTRADICTORY';

/**
 * Weakness Category Taxonomy
 */
export type WeaknessCategory =
  | 'COMMUNICATION_GAP'
  | 'EVIDENCE_GAP'
  | 'LOGIC_GAP';

/**
 * Narrative Chain Transition Status
 */
export type NarrativeTransitionStatus =
  | 'clear'
  | 'weak'
  | 'missing'
  | 'contradictory';

/**
 * Reconstructed Fundraising Thesis Pillar
 */
export interface ThesisPillar {
  pillar:
    | 'Problem'
    | 'Customer'
    | 'Solution'
    | 'Why Now'
    | 'Market'
    | 'Traction'
    | 'Business Model'
    | 'GTM'
    | 'Competitive Advantage'
    | 'Team'
    | 'Fundraising';
  communicated: boolean;
  summary: string;
  slideNumbers: number[];
}

/**
 * Evaluation of an Individual Dimension
 */
export interface DimensionEvaluation {
  id: string;
  dimensionName: string;
  status: DimensionStatus;
  finding: string;
  rationale: string;
  slideReferences: number[];
  relatedClaimIds?: string[];
  evidenceSummary?: string;
  unresolvedIssue?: string;
  weaknessType?: WeaknessCategory;
}

/**
 * Step in the Fundraising Narrative Chain
 */
export interface NarrativeChainTransition {
  fromPillar: string;
  toPillar: string;
  status: NarrativeTransitionStatus;
  assessment: string;
  slideNumbers: number[];
}

/**
 * Likely Investor Objection Triggered by Deck Gaps
 */
export interface InvestorObjection {
  id: string;
  objection: string;
  triggeringGap: string;
  relevantSlides: number[];
  importance: 'critical' | 'material' | 'secondary';
}

/**
 * Strong Element of the Fundraising Case
 */
export interface StrongElement {
  id: string;
  pillarOrDimension: string;
  highlight: string;
  evidence: string;
  slideNumbers: number[];
}

/**
 * Aggregated Summary of Dimension Statuses
 */
export interface DimensionSummary {
  strongCount: number;
  adequateCount: number;
  underdevelopedCount: number;
  missingCount: number;
  contradictoryCount: number;
}

/**
 * Complete Canonical Fundraising Evaluation Result
 */
export interface FundraisingEvaluation {
  reconstructedThesis: ThesisPillar[];
  dimensions: DimensionEvaluation[];
  narrativeChain: NarrativeChainTransition[];
  investorObjections: InvestorObjection[];
  strongElements: StrongElement[];
  dimensionSummary: DimensionSummary;
  overallSynthesis: string;
  evaluatedAt: Date;
}

/**
 * Evaluation Processing State in UI
 */
export type EvaluationStatus = 'idle' | 'evaluating' | 'success' | 'error';

export interface EvaluationState {
  status: EvaluationStatus;
  evaluation: FundraisingEvaluation | null;
  errorMessage: string | null;
}

