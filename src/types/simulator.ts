import { ProvenanceSource } from './deck';

/**
 * Question Category Taxonomy
 */
export type QuestionCategory =
  | 'problem'
  | 'customer_icp'
  | 'solution'
  | 'product'
  | 'traction'
  | 'revenue'
  | 'growth'
  | 'retention'
  | 'business_model'
  | 'unit_economics'
  | 'go_to_market'
  | 'market'
  | 'competition'
  | 'differentiation'
  | 'defensibility'
  | 'technology'
  | 'team'
  | 'fundraising'
  | 'use_of_funds'
  | 'risk'
  | 'execution'
  | 'other';

/**
 * Question Priority Level
 */
export type QuestionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM';

/**
 * Question Functional Type
 */
export type QuestionType =
  | 'CLARIFICATION'
  | 'EVIDENCE'
  | 'MECHANISM'
  | 'ECONOMICS'
  | 'SCALABILITY'
  | 'COMPETITIVE'
  | 'RISK'
  | 'EXECUTION'
  | 'TRACTION'
  | 'FUNDRAISING'
  | 'FOLLOW_UP';

/**
 * How well the existing deck evidence prepares the founder to answer
 */
export type AnswerabilityStatus =
  | 'WELL_SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'WEAKLY_SUPPORTED'
  | 'UNANSWERED'
  | 'CONTRADICTORY';

/**
 * Concrete trigger within the pitch deck evidence or analysis
 */
export interface QuestionTrigger {
  relatedDimension?: string;
  relatedClaimIds: string[];
  relatedDiagnosticIds: string[];
  slideNumbers: number[];
  triggerSummary: string;
}

/**
 * Evidence item already found in the deck supporting the answer
 */
export interface QuestionEvidenceItem {
  slideNumber: number;
  statement: string;
  source: ProvenanceSource;
}

/**
 * Diligence Question Model
 */
export interface InvestorQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  priority: QuestionPriority;
  questionType: QuestionType;
  whyInvestorAsks: string;
  trigger: QuestionTrigger;
  currentAnswerability: AnswerabilityStatus;
  availableEvidence: QuestionEvidenceItem[];
  missingInformation: string[];
  preparationGuidance: string;
  groundedAnswer?: string; // Labeled "Answer using current deck evidence", strictly grounded
  likelyFollowUps: string[]; // Up to 2 logical follow-ups
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Factual Preparation Summary across all simulated questions
 */
export interface PreparationSummary {
  totalQuestions: number;
  wellSupportedCount: number;
  partiallySupportedCount: number;
  weaklySupportedCount: number;
  unansweredCount: number;
  contradictoryCount: number;
  mostExposedAreas: string[]; // Categories with highest unaddressed/weak questions
}

/**
 * Complete canonical result from Investor Q&A & Due Diligence Simulator
 */
export interface InvestorSimulatorResult {
  questions: InvestorQuestion[];
  summary: PreparationSummary;
  generatedAt: Date;
}

/**
 * UI State for Investor Simulator
 */
export type SimulatorStatus = 'idle' | 'simulating' | 'success' | 'error';

export interface SimulatorState {
  status: SimulatorStatus;
  result: InvestorSimulatorResult | null;
  errorMessage: string | null;
}

